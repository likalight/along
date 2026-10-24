// swift-tools-version: 6.0
import PackageDescription

let package = Package(
    name: "AlongContext",
    platforms: [.macOS(.v14)],
    products: [.executable(name: "AlongContext", targets: ["AlongContext"])],
    targets: [.executableTarget(name: "AlongContext")]
)
