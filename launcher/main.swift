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
    // Assume the .app is inside the project directory
    let bundle = Bundle.main.bundlePath
    projectDir = (bundle as NSString).deletingLastPathComponent
}

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
    let log = FileHandle(forWritingAtPath: "/tmp/vibe-terminal.log") ?? FileHandle.nullDevice
    server.standardOutput = log
    server.standardError = log
    try? server.run()

    // Wait for server to be ready
    for _ in 0..<30 {
        let check = Process()
        check.executableURL = URL(fileURLWithPath: "/usr/bin/curl")
        check.arguments = ["-s", "http://localhost:\(port)"]
        check.standardOutput = FileHandle.nullDevice
        check.standardError = FileHandle.nullDevice
        try? check.run()
        check.waitUntilExit()
        if check.terminationStatus == 0 { break }
        Thread.sleep(forTimeInterval: 0.2)
    }
}

// Open Chrome in app mode
let chrome = Process()
chrome.executableURL = URL(fileURLWithPath: "/usr/bin/open")
chrome.arguments = ["-na", "Google Chrome", "--args", "--app=http://localhost:\(port)/loading.html", "--new-window"]
try? chrome.run()

// Register as a proper GUI app so macOS shows dock dot and stops bouncing
let app = NSApplication.shared
app.setActivationPolicy(.regular)

// Wait for Chrome window to appear, then watch for it to close
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

// Keep alive — quit via Dock right-click → Quit
app.run()
