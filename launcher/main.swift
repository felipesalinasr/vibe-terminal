import AppKit
import Foundation

let port = 8765

// Resolve project directory: config file > fallback to parent of .app bundle
let configPath = NSString(string: "~/.config/vibe-terminal/project-dir").expandingTildeInPath
let projectDir: String
if FileManager.default.fileExists(atPath: configPath),
   let configured = try? String(contentsOfFile: configPath, encoding: .utf8) {
    projectDir = configured.trimmingCharacters(in: .whitespacesAndNewlines)
} else {
    let bundle = Bundle.main.bundlePath
    projectDir = (bundle as NSString).deletingLastPathComponent
}

// Bring the exact Chrome tab with Vibe Terminal to front
func focusVibeWindow() {
    let script = Process()
    script.executableURL = URL(fileURLWithPath: "/usr/bin/osascript")
    script.arguments = ["-e", """
        tell application "Google Chrome"
            activate
            set found to false
            repeat with w from 1 to (count windows)
                repeat with t from 1 to (count tabs of window w)
                    if URL of tab t of window w contains "localhost:\(port)" then
                        set active tab index of window w to t
                        set index of window w to 1
                        set found to true
                        exit repeat
                    end if
                end repeat
                if found then exit repeat
            end repeat
        end tell
        """]
    script.standardOutput = FileHandle.nullDevice
    script.standardError = FileHandle.nullDevice
    try? script.run()
}

// App delegate — handles dock icon clicks
class AppDelegate: NSObject, NSApplicationDelegate {
    var launched = false

    func applicationDidFinishLaunching(_ notification: Notification) {
        launched = true
    }

    func applicationShouldHandleReopen(_ sender: NSApplication, hasVisibleWindows flag: Bool) -> Bool {
        if launched {
            DispatchQueue.global().async { focusVibeWindow() }
        }
        return false
    }
}

let appDelegate = AppDelegate()

// Start server if not running
let checkPort = Process()
checkPort.executableURL = URL(fileURLWithPath: "/usr/sbin/lsof")
checkPort.arguments = ["-ti", ":\(port)"]
checkPort.standardOutput = FileHandle.nullDevice
checkPort.standardError = FileHandle.nullDevice
try? checkPort.run()
checkPort.waitUntilExit()

if checkPort.terminationStatus != 0 {
    let server = Process()
    server.executableURL = URL(fileURLWithPath: "/usr/local/bin/node")
    server.arguments = ["\(projectDir)/server/index.js"]
    server.currentDirectoryURL = URL(fileURLWithPath: projectDir)
    // Create log file if it doesn't exist
    FileManager.default.createFile(atPath: "/tmp/vibe-terminal.log", contents: nil)
    let log = FileHandle(forWritingAtPath: "/tmp/vibe-terminal.log") ?? FileHandle.nullDevice
    server.standardOutput = log
    server.standardError = log
    try? server.run()
}

// Always wait for server to be ready before opening Chrome
for _ in 0..<50 {
    let check = Process()
    check.executableURL = URL(fileURLWithPath: "/usr/bin/curl")
    check.arguments = ["-sf", "http://localhost:\(port)/api/sessions"]
    check.standardOutput = FileHandle.nullDevice
    check.standardError = FileHandle.nullDevice
    try? check.run()
    check.waitUntilExit()
    if check.terminationStatus == 0 { break }
    Thread.sleep(forTimeInterval: 0.2)
}

// Check if Vibe Terminal tab already exists — focus it instead of opening a new one
let tabCheck = Process()
tabCheck.executableURL = URL(fileURLWithPath: "/usr/bin/osascript")
tabCheck.arguments = ["-e", """
    tell application "Google Chrome"
        repeat with w in windows
            repeat with t in tabs of w
                if URL of t contains "localhost:\(port)" then return "found"
            end repeat
        end repeat
    end tell
    return "none"
    """]
let tabPipe = Pipe()
tabCheck.standardOutput = tabPipe
tabCheck.standardError = FileHandle.nullDevice
try? tabCheck.run()
tabCheck.waitUntilExit()
let tabResult = String(data: tabPipe.fileHandleForReading.readDataToEndOfFile(), encoding: .utf8)?.trimmingCharacters(in: .whitespacesAndNewlines) ?? ""

if tabResult == "found" {
    // Tab exists — just focus it
    focusVibeWindow()
} else {
    // No tab — open a new one, go straight to /
    let chrome = Process()
    chrome.executableURL = URL(fileURLWithPath: "/usr/bin/open")
    chrome.arguments = ["-a", "Google Chrome", "http://localhost:\(port)"]
    try? chrome.run()
}

// Register as a proper GUI app
let app = NSApplication.shared
app.delegate = appDelegate
app.setActivationPolicy(.regular)

// Watch for Chrome window to close → quit launcher
DispatchQueue.global().async {
    var windowFound = false
    while true {
        Thread.sleep(forTimeInterval: 2)
        let check = Process()
        check.executableURL = URL(fileURLWithPath: "/usr/bin/osascript")
        check.arguments = ["-e", """
            tell application "Google Chrome"
                repeat with w in windows
                    repeat with t in tabs of w
                        if URL of t contains "localhost:\(port)" then return "open"
                    end repeat
                end repeat
            end tell
            return "closed"
            """]
        let pipe = Pipe()
        check.standardOutput = pipe
        check.standardError = FileHandle.nullDevice
        try? check.run()
        check.waitUntilExit()
        let output = String(data: pipe.fileHandleForReading.readDataToEndOfFile(), encoding: .utf8)?.trimmingCharacters(in: .whitespacesAndNewlines) ?? ""
        if output == "open" {
            windowFound = true
        } else if windowFound && output == "closed" {
            DispatchQueue.main.async { app.terminate(nil) }
            break
        }
    }
}

app.run()
