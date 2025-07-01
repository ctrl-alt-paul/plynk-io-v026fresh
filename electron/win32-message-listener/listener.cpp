// listener.cpp
#include <napi.h>
#include <windows.h>
#include <string>
#include <unordered_map>
#include <thread>
#include <atomic>
#include <iostream>
#include <cstring>  // for strnlen

constexpr char kWndClassName[] = "MAMEHooker";

// Custom Windows messages from MAME
UINT WM_MAME_START, WM_MAME_STOP,
     WM_MAME_REGISTER, WM_MAME_UPDATE, WM_MAME_GET_ID,
     WM_MAME_UNREG, WM_MAME_REG;

static HWND              g_hwnd     = nullptr;
static HWND              g_mameHWND = nullptr;
static std::thread       g_msgThread;
static std::atomic<bool> g_running{true};
static std::unordered_map<UINT, std::string> g_idToName;
static std::string       g_currentRomName;

// JS callback
static Napi::ThreadSafeFunction g_tsfn;

// Allow messages through UIPI
void allowMsg(HWND hwnd, UINT msg) {
    if (!ChangeWindowMessageFilterEx(hwnd, msg, MSGFLT_ALLOW, nullptr)) {
        std::cerr << "[listener] Failed to allow msg " << msg << "\n";
    }
}

// Send a numeric or event to JS
void pushToJS(const std::string& key, int value) {
    if (!g_tsfn) return;
    g_tsfn.BlockingCall([key,value](Napi::Env env, Napi::Function cb){
        Napi::Object o = Napi::Object::New(env);
        o.Set("key",   key);
        o.Set("value", value);
        cb.Call({ o });
    });
}

// Send a label (id→string) to JS
void pushLabelToJS(const std::string& key, const std::string& label) {
    if (!g_tsfn) return;
    g_tsfn.BlockingCall([key,label](Napi::Env env, Napi::Function cb){
        Napi::Object o = Napi::Object::New(env);
        o.Set("key",   key);
        o.Set("label", label);
        cb.Call({ o });
    });
}

// Send a pure string (e.g. game name) to JS
void pushStringToJS(const std::string& key, const std::string& s) {
    if (!g_tsfn) return;
    g_tsfn.BlockingCall([key,s](Napi::Env env, Napi::Function cb){
        Napi::Object o = Napi::Object::New(env);
        o.Set("key",   key);
        o.Set("text",  s);
        cb.Call({ o });
    });
}

LRESULT CALLBACK WndProc(HWND hwnd, UINT msg, WPARAM wp, LPARAM lp) {
    if (msg == WM_COPYDATA) {
        auto cds = reinterpret_cast<PCOPYDATASTRUCT>(lp);
        //std::cerr << "[listener] WM_COPYDATA dwData=" << cds->dwData
        //          << " cbData=" << cds->cbData << "\n";

        // === 1. Primary: id+label packets (dwData==1) ===
        if (cds->dwData == 1 && cds->cbData >= sizeof(UINT) + 1) {
            const BYTE* buf    = static_cast<const BYTE*>(cds->lpData);
            UINT        id     = *reinterpret_cast<const UINT*>(buf);
            const char* strBuf = reinterpret_cast<const char*>(buf + sizeof(UINT));
            size_t      maxLen = cds->cbData - sizeof(UINT);
            size_t      len    = strnlen(strBuf, maxLen);
            std::string label(strBuf, len);  // trimmed at first NUL

            if (id == 0) {
                g_currentRomName = label;
                pushStringToJS("__GAME_NAME__", label);
                // seed UI row immediately
                pushToJS("__GAME_NAME__", 0);
            } else {
                g_idToName[id] = label;
                pushLabelToJS("id_" + std::to_string(id), label);
                // seed UI row immediately
                pushToJS("id_" + std::to_string(id), 0);
            }
            return TRUE;
        }

        // === 2. Fallback: key=value updates ===
        if (cds->cbData > 3) {
            std::string payload(static_cast<char*>(cds->lpData), cds->cbData);
            auto eq = payload.find('=');
            if (eq != std::string::npos) {
                std::string key = payload.substr(0, eq);
                int         v   = std::stoi(payload.substr(eq + 1));
                pushToJS(key, v);
                return TRUE;
            }
        }

        return TRUE;
    }

    if (msg == WM_MAME_START) {
        g_mameHWND = reinterpret_cast<HWND>(wp);
        HWND me    = hwnd;
        g_idToName.clear();
        pushToJS("__MAME_START__", 1);

        // register for updates
        PostMessage(HWND_BROADCAST, WM_MAME_REG,   reinterpret_cast<WPARAM>(me), 0);
        PostMessage(g_mameHWND,      WM_MAME_REG,   reinterpret_cast<WPARAM>(me), 0);

        // ask for all id→label mappings up front
        PostMessage(HWND_BROADCAST, WM_MAME_GET_ID, reinterpret_cast<WPARAM>(me), 0);
        PostMessage(g_mameHWND,      WM_MAME_GET_ID, reinterpret_cast<WPARAM>(me), 0);
        return 0;
    }

    if (msg == WM_MAME_REGISTER) {
        UINT id = static_cast<UINT>(lp);
        // request label by both broadcast & direct
        PostMessage(HWND_BROADCAST, WM_MAME_GET_ID, reinterpret_cast<WPARAM>(hwnd), id);
        PostMessage(g_mameHWND,      WM_MAME_GET_ID, reinterpret_cast<WPARAM>(hwnd), id);
        return 0;
    }

    if (msg == WM_MAME_UPDATE) {
        UINT id  = static_cast<UINT>(wp);
        int  val = static_cast<int>(lp);

        // if we haven't seen a label for this ID yet, ask for it
        if (id != 0 && !g_idToName.count(id) && g_mameHWND) {
            PostMessage(HWND_BROADCAST, WM_MAME_GET_ID, reinterpret_cast<WPARAM>(hwnd), id);
            PostMessage(g_mameHWND,      WM_MAME_GET_ID, reinterpret_cast<WPARAM>(hwnd), id);
        }

        // always use the stable "id_<n>" key (or "__GAME_NAME__" for the special 0)
        std::string keyStr = (id == 0)
            ? std::string("__GAME_NAME__")
            : std::string("id_") + std::to_string(id);

        pushToJS(keyStr, val);
        return 0;
    }

    if (msg == WM_MAME_UNREG) {
        g_idToName.erase(static_cast<UINT>(lp));
        return 0;
    }

    if (msg == WM_MAME_STOP) {
        pushToJS("__MAME_STOP__", 0);
        return 0;
    }

    return DefWindowProc(hwnd, msg, wp, lp);
}

void messagePump() {
    // resolve custom messages
    WM_MAME_REG      = RegisterWindowMessageA("MAMEOutputRegister");
    WM_MAME_START    = RegisterWindowMessageA("MAMEOutputStart");
    WM_MAME_STOP     = RegisterWindowMessageA("MAMEOutputStop");
    WM_MAME_REGISTER = RegisterWindowMessageA("MAMEOutputRegister");
    WM_MAME_UPDATE   = RegisterWindowMessageA("MAMEOutputUpdateState");
    WM_MAME_GET_ID   = RegisterWindowMessageA("MAMEOutputGetIDString");
    WM_MAME_UNREG    = RegisterWindowMessageA("MAMEOutputUnregister");

    // create (and only once) a hidden window class
    static bool classRegistered = false;
    if (!classRegistered) {
        WNDCLASSA wc{};
        wc.lpfnWndProc   = WndProc;
        wc.lpszClassName = kWndClassName;
        wc.hInstance     = GetModuleHandle(nullptr);
        RegisterClassA(&wc);
        classRegistered = true;
    }

    // now create the hidden window
    g_hwnd = CreateWindowA(
      kWndClassName, "PlynkIO Listener",
      0, CW_USEDEFAULT, CW_USEDEFAULT, 0, 0,
      nullptr, nullptr, GetModuleHandle(nullptr), nullptr
    );

    // allow messages through UIPI
    UINT allowList[] = {
      WM_COPYDATA, WM_MAME_START, WM_MAME_REGISTER,
      WM_MAME_UPDATE, WM_MAME_GET_ID, WM_MAME_UNREG,
      WM_MAME_STOP,  WM_MAME_REG
    };
    for (auto m : allowList) allowMsg(g_hwnd, m);

    // run the message loop until stopListener() posts WM_QUIT
    MSG msg;
    while (g_running && GetMessage(&msg, nullptr, 0, 0)) {
        TranslateMessage(&msg);
        DispatchMessage(&msg);
    }

    // destroy the hidden window so we can re-create it on restart
    if (g_hwnd) {
        DestroyWindow(g_hwnd);
        g_hwnd = nullptr;
    }

    // NOTE: we do NOT call UnregisterClassA here,
    // so the window class remains available on subsequent starts.
}



// N-API exports
Napi::Value StartListener(const Napi::CallbackInfo& info) {
    auto env = info.Env();
    if (info.Length() < 1 || !info[0].IsFunction()) {
        Napi::TypeError::New(env, "Callback required").ThrowAsJavaScriptException();
        return env.Null();
    }

    // If we're already running, don't spin up another thread
    if (g_msgThread.joinable()) {
        return Napi::Boolean::New(env, true);
    }

    // Reset the run flag so messagePump will loop
    g_running = true;

    // (Re)create the ThreadSafeFunction
    g_tsfn = Napi::ThreadSafeFunction::New(
        env,
        info[0].As<Napi::Function>(),
        "Win32Listener",
        0,
        1
    );

    // Launch the message‐pump thread
    g_msgThread = std::thread(messagePump);

    return Napi::Boolean::New(env, true);
}

Napi::Value StopListener(const Napi::CallbackInfo& info) {
    // tell the pump to exit
    g_running = false;
    PostThreadMessage(
        GetThreadId(g_msgThread.native_handle()),
        WM_QUIT, 0, 0
    );
    if (g_msgThread.joinable()) {
        g_msgThread.join();
    }
    if (g_tsfn) {
        g_tsfn.Release();
    }
    return info.Env().Undefined();
}

Napi::Object Init(Napi::Env env, Napi::Object exports) {
    exports.Set("startListener",
        Napi::Function::New(env, StartListener));
    exports.Set("stopListener",
        Napi::Function::New(env, StopListener));
    return exports;
}

NODE_API_MODULE(listener, Init)



