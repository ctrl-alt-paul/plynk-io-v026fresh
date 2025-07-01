#NoEnv
SendMode Input
DetectHiddenWindows, On
SetTitleMatchMode, 2

SetTimer, SendMessageToWindow, -10
return

SendMessageToWindow:
targetTitle := "PLYNKIO_MAME_OUTPUT_LISTENER"
message := "lamp=1"

hwnd := WinExist("ahk_class " . targetTitle)
if (!hwnd) {
    MsgBox, 48, Not Found, Could not find window titled "%targetTitle%"
    return
}

VarSetCapacity(copyDataStruct, 3 * A_PtrSize, 0)
NumPut(0, copyDataStruct, 0, "Ptr")                          ; dwData
NumPut(StrLen(message) + 1, copyDataStruct, A_PtrSize, "UInt") ; cbData
NumPut(&message, copyDataStruct, 2 * A_PtrSize, "Ptr")       ; lpData

result := DllCall("SendMessage", "Ptr", hwnd, "UInt", 0x004A, "Ptr", 0, "Ptr", &copyDataStruct)

if (result) {
    MsgBox, 64, Success, Sent WM_COPYDATA to "%targetTitle%" with payload:`n%message%
} else {
    MsgBox, 16, Failure, Failed to send WM_COPYDATA to "%targetTitle%"
}
return
