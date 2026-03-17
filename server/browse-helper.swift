import AppKit

let panel = NSOpenPanel()
panel.canChooseDirectories = true
panel.canChooseFiles = false
panel.allowsMultipleSelection = false
panel.prompt = "Select"

let app = NSApplication.shared
app.setActivationPolicy(.accessory)
app.activate(ignoringOtherApps: true)

if panel.runModal() == .OK, let url = panel.url {
    print(url.path)
}
