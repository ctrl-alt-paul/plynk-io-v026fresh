#Persistent
SetTitleMatchMode, 3
WinGet, id, list

output := "Open Windows:`n`n"
Loop, %id%
{
    this_id := id%A_Index%
    WinGetTitle, title, ahk_id %this_id%
    WinGetClass, class, ahk_id %this_id%
    WinGet, exe, ProcessName, ahk_id %this_id%
    if (title)
        output .= "Title: " title "`nClass: " class "`nExe: " exe "`n`n"
}
MsgBox, %output%
ExitApp
