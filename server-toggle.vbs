Set WshShell = CreateObject("WScript.Shell")
Set fso = CreateObject("Scripting.FileSystemObject")

' Get script directory
scriptDir = fso.GetParentFolderName(WScript.ScriptFullName)

' Check if server is running on port 3333
Set exec = WshShell.Exec("cmd /c netstat -ano | findstr "":3333.*LISTENING""")
output = exec.StdOut.ReadAll()

If Len(Trim(output)) > 0 Then
    ' Server running — extract PID and kill
    lines = Split(output, vbCrLf)
    For Each line In lines
        line = Trim(line)
        If Len(line) > 0 Then
            parts = Split(line)
            pid = parts(UBound(parts))
            If IsNumeric(pid) And CInt(pid) > 0 Then
                WshShell.Run "taskkill /PID " & pid & " /F", 0, True
            End If
        End If
    Next
    ' Server stopped silently
Else
    ' Server not running — start it
    WshShell.CurrentDirectory = scriptDir
    WshShell.Run "cmd /c node server.js", 0, False
    WScript.Sleep 1500
    WshShell.Run "chrome http://localhost:3333", 0, False
    ' Server started silently
End If
