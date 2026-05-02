import UIKit
import SwiftUI
import Capacitor

@UIApplicationMain
class AppDelegate: UIResponder, UIApplicationDelegate {

    var window: UIWindow?

    func application(
        _ application: UIApplication,
        didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]?
    ) -> Bool {

        // Strip the legacy UITabBar chrome so the iOS 26 floating glass
        // TabView doesn't show a white surface around the capsule on the
        // sides / behind the home indicator.
        UITabBar.appearance().backgroundColor = .clear
        UITabBar.appearance().backgroundImage = UIImage()
        UITabBar.appearance().shadowImage     = UIImage()

        let win = UIWindow(frame: UIScreen.main.bounds)
        win.backgroundColor = .black

        if #available(iOS 26.0, *) {
            let host = UIHostingController(rootView: LiquidGlassTabView())
            host.view.backgroundColor = .black
            win.rootViewController = host
        } else {
            // Fallback: load Main.storyboard's CAPBridgeViewController directly.
            let sb   = UIStoryboard(name: "Main", bundle: nil)
            let root = sb.instantiateInitialViewController() ?? CAPBridgeViewController()
            root.view.backgroundColor = .black
            win.rootViewController = root
        }

        win.makeKeyAndVisible()
        window = win

        return true
    }

    func applicationWillResignActive(_ application: UIApplication) {}
    func applicationDidEnterBackground(_ application: UIApplication) {}
    func applicationWillEnterForeground(_ application: UIApplication) {}
    func applicationDidBecomeActive(_ application: UIApplication) {}
    func applicationWillTerminate(_ application: UIApplication) {}

    func application(
        _ app: UIApplication,
        open url: URL,
        options: [UIApplication.OpenURLOptionsKey: Any] = [:]
    ) -> Bool {
        ApplicationDelegateProxy.shared.application(app, open: url, options: options)
    }

    func application(
        _ application: UIApplication,
        continue userActivity: NSUserActivity,
        restorationHandler: @escaping ([UIUserActivityRestoring]?) -> Void
    ) -> Bool {
        ApplicationDelegateProxy.shared.application(
            application,
            continue: userActivity,
            restorationHandler: restorationHandler
        )
    }
}
