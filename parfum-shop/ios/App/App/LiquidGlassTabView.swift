//
//  LiquidGlassTabView.swift
//  Kemal Usman — Parfum Shop
//
//  iOS 26 native Liquid Glass tab bar.
//
//  Tab bar pattern is the same as Apple's iOS-26-by-Examples NewTabView.swift —
//  the system TabView with `Tab(_, systemImage:, value:)` and
//  `.tabBarMinimizeBehavior(.onScrollDown)`. The system supplies the active
//  glass capsule, the blue tint, the floating shadow and the symbol bounce.
//
//  Architecture: our app is a SINGLE shared Capacitor WKWebView (one React
//  app, one global state). Apple's `Tab { content }` API expects each tab to
//  own its own content view. Resolution: ONE shared `CAPBridgeViewController`
//  (`SharedBridge.vc`) is moved between per-tab `WebHostVC`s on tab switch
//  via UIKit `addChild` / `removeFromParent` re-parenting. Reparenting does
//  not destroy the WKWebView — its rendering, JS state and React state all
//  survive the move. Each `Tab` content embeds a `WebHostVC`, so the system
//  TabView's content area shows the WebView directly (no separate ZStack
//  layer that the TabView could paint over).
//

import SwiftUI
import UIKit
import Capacitor
import WebKit

// MARK: - Tab models

enum AppTab: String, CaseIterable, Identifiable, Hashable {
    case catalog = "catalog"
    case cart    = "cart"
    case orders  = "myorders"
    case profile = "profile"

    var id: String { rawValue }

    var label: String {
        switch self {
        case .catalog: "Каталог"
        case .cart:    "Корзина"
        case .orders:  "Мои заказы"
        case .profile: "Профиль"
        }
    }

    var symbol: String {
        switch self {
        case .catalog: "house.fill"
        case .cart:    "cart.fill"
        case .orders:  "list.bullet"
        case .profile: "person.fill"
        }
    }
}

enum AdminTab: String, CaseIterable, Identifiable, Hashable {
    case orders   = "orders"
    case products = "products"
    case stats    = "stats"
    case settings = "settings"

    var id: String { rawValue }

    var label: String {
        switch self {
        case .orders:   "Заказы"
        case .products: "Товары"
        case .stats:    "Статистика"
        case .settings: "Настройки"
        }
    }

    var symbol: String {
        switch self {
        case .orders:   "list.bullet"
        case .products: "shippingbox.fill"
        case .stats:    "chart.bar.fill"
        case .settings: "gearshape.fill"
        }
    }
}

enum BarMode: Equatable {
    case hidden
    case user
    case admin
}

// MARK: - Shared state

@MainActor
final class TabState: ObservableObject {
    @Published var mode:          BarMode  = .hidden
    @Published var selectedUser:  AppTab   = .catalog
    @Published var selectedAdmin: AdminTab = .orders
    @Published var cartBadge:     Int      = 0
}

// MARK: - Haptics

enum Haptics {
    static func tabTapped() {
        UIImpactFeedbackGenerator(style: .medium).impactOccurred()
    }
}

// MARK: - Root view

@available(iOS 26.0, *)
struct LiquidGlassTabView: View {
    @StateObject private var state = TabState()

    var body: some View {
        Group {
            switch state.mode {
            case .hidden:
                // Login / register: no tab bar, full-screen WebView.
                WebHost(state: state)
                    .ignoresSafeArea()
            case .user:
                userTabView
            case .admin:
                adminTabView
            }
        }
        .background(Color.black)
        .ignoresSafeArea(.all)
        .animation(.spring(response: 0.45, dampingFraction: 0.78), value: state.mode)
        .ignoresSafeArea(.keyboard, edges: .bottom)
    }

    // MARK: User tabs — system iOS 26 TabView

    private var userTabView: some View {
        TabView(selection: userBinding) {
            Tab(AppTab.catalog.label,
                systemImage: AppTab.catalog.symbol,
                value: AppTab.catalog) {
                WebHost(state: state).ignoresSafeArea(edges: .top)
            }

            Tab(AppTab.cart.label,
                systemImage: AppTab.cart.symbol,
                value: AppTab.cart) {
                WebHost(state: state).ignoresSafeArea(edges: .top)
            }
            .badge(state.cartBadge)

            Tab(AppTab.orders.label,
                systemImage: AppTab.orders.symbol,
                value: AppTab.orders) {
                WebHost(state: state).ignoresSafeArea(edges: .top)
            }

            Tab(AppTab.profile.label,
                systemImage: AppTab.profile.symbol,
                value: AppTab.profile) {
                WebHost(state: state).ignoresSafeArea(edges: .top)
            }
        }
        .tabViewStyle(.automatic)
        .background(Color.clear)
        .tabBarMinimizeBehavior(.onScrollDown)
    }

    // MARK: Admin tabs — same system TabView, different items

    private var adminTabView: some View {
        TabView(selection: adminBinding) {
            Tab(AdminTab.orders.label,
                systemImage: AdminTab.orders.symbol,
                value: AdminTab.orders) {
                WebHost(state: state).ignoresSafeArea(edges: .top)
            }

            Tab(AdminTab.products.label,
                systemImage: AdminTab.products.symbol,
                value: AdminTab.products) {
                WebHost(state: state).ignoresSafeArea(edges: .top)
            }

            Tab(AdminTab.stats.label,
                systemImage: AdminTab.stats.symbol,
                value: AdminTab.stats) {
                WebHost(state: state).ignoresSafeArea(edges: .top)
            }

            Tab(AdminTab.settings.label,
                systemImage: AdminTab.settings.symbol,
                value: AdminTab.settings) {
                WebHost(state: state).ignoresSafeArea(edges: .top)
            }
        }
        .tabViewStyle(.automatic)
        .background(Color.clear)
        .tabBarMinimizeBehavior(.onScrollDown)
    }

    // MARK: Selection bindings (haptics + tab dispatch)

    private var userBinding: Binding<AppTab> {
        Binding(
            get: { state.selectedUser },
            set: { newTab in
                guard newTab != state.selectedUser else { return }
                Haptics.tabTapped()
                state.selectedUser = newTab
                SharedBridge.shared.dispatchUserTab(newTab)
            }
        )
    }

    private var adminBinding: Binding<AdminTab> {
        Binding(
            get: { state.selectedAdmin },
            set: { newTab in
                guard newTab != state.selectedAdmin else { return }
                Haptics.tabTapped()
                state.selectedAdmin = newTab
                SharedBridge.shared.dispatchAdminTab(newTab)
            }
        )
    }
}

// MARK: - SwiftUI representable that hosts the shared WebView

@available(iOS 26.0, *)
struct WebHost: UIViewControllerRepresentable {
    @ObservedObject var state: TabState

    func makeUIViewController(context: Context) -> WebHostVC {
        let host = WebHostVC()
        // First time we mount any host: wire shared bridge callbacks once.
        SharedBridge.shared.bind(state: state)
        return host
    }

    func updateUIViewController(_ vc: WebHostVC, context: Context) {
        // Each time SwiftUI updates this Tab content, re-adopt the shared
        // CAPBridgeViewController into this host (no-op if already here).
        vc.adoptShared()
    }
}

// MARK: - Per-tab UIKit host that owns the shared bridge while visible

final class WebHostVC: UIViewController {

    override func viewDidLoad() {
        super.viewDidLoad()
        view.backgroundColor = .black
        adoptShared()
    }

    override func viewWillAppear(_ animated: Bool) {
        super.viewWillAppear(animated)
        adoptShared()
    }

    /// Move the singleton CAPBridgeViewController into this host.
    /// Safe to call repeatedly — no-ops if already attached.
    func adoptShared() {
        let bridge = SharedBridge.shared.vc
        if bridge.parent === self {
            // Already attached; just make sure frame is current.
            bridge.view.frame = view.bounds
            return
        }

        // Detach from previous host, if any.
        if bridge.parent != nil {
            bridge.willMove(toParent: nil)
            bridge.view.removeFromSuperview()
            bridge.removeFromParent()
        }

        // Attach to me.
        addChild(bridge)
        bridge.view.frame            = view.bounds
        bridge.view.autoresizingMask = [.flexibleWidth, .flexibleHeight]
        bridge.view.backgroundColor  = .black
        view.addSubview(bridge.view)
        bridge.didMove(toParent: self)

        // Also paint the underlying WKWebView's surface black so the
        // brief moment before HTML paints doesn't flash white.
        if let wk = SharedBridge.shared.findWebView(in: bridge.view) {
            wk.backgroundColor      = .black
            wk.isOpaque             = false
            wk.scrollView.backgroundColor = .black
        }

        print("Bridge: WebHostVC adopted shared bridgeVC, host=\(self), frame=\(bridge.view.frame)")

        // First adopt anywhere triggers WebView lookup + handler install.
        SharedBridge.shared.attemptInstallHandlers()
    }
}

// MARK: - Singleton bridge: one CAPBridgeViewController for the whole app

@MainActor
final class SharedBridge {

    static let shared = SharedBridge()

    let vc: CAPBridgeViewController

    // Callbacks back into SwiftUI state — set once via `bind(state:)`.
    private var onUserTabChange:  ((AppTab)   -> Void)?
    private var onAdminTabChange: ((AdminTab) -> Void)?
    private var onModeChange:     ((BarMode)  -> Void)?
    private var onBadge:          ((Int)      -> Void)?

    private var handlersInstalled = false
    private var lastUserTab:  AppTab?
    private var lastAdminTab: AdminTab?
    private var loadObs:      NSKeyValueObservation?
    private var stateRef:     TabState?

    private let bridgeJS = """
    (function () {
      if (window.__nativeBridge) return;
      window.__nativeBridge = true;

      window.__nativeTabChange = function (tab) {
        try { window.dispatchEvent(new CustomEvent('__nativeTabChange', { detail: tab })); } catch (_) {}
      };
      window.__nativeAdminTabChange = function (tab) {
        try { window.dispatchEvent(new CustomEvent('__nativeAdminTabChange', { detail: tab })); } catch (_) {}
      };
      window.__setCartBadge = function (n) {
        try { webkit.messageHandlers.cartBadge.postMessage(n | 0); } catch (_) {}
      };
      window.__syncTab = function (tab) {
        try { webkit.messageHandlers.syncTab.postMessage(String(tab)); } catch (_) {}
      };
      window.__setAdminMode = function (on) {
        try { webkit.messageHandlers.adminMode.postMessage(!!on); } catch (_) {}
      };
    })();
    """

    private init() {
        print("Bridge: starting…")
        let sb = UIStoryboard(name: "Main", bundle: nil)
        if let cap = sb.instantiateInitialViewController() as? CAPBridgeViewController {
            self.vc = cap
            print("Bridge: storyboard CAPBridgeViewController loaded: \(cap)")
        } else {
            self.vc = CAPBridgeViewController()
            print("Bridge: WARNING — storyboard did not return CAPBridgeViewController, using default")
        }
    }

    /// Wire SwiftUI state callbacks. Idempotent across multiple Tab hosts.
    func bind(state: TabState) {
        self.stateRef = state
        self.onUserTabChange = { [weak state] tab in
            DispatchQueue.main.async {
                guard let s = state, s.selectedUser != tab else { return }
                s.selectedUser = tab
            }
        }
        self.onAdminTabChange = { [weak state] tab in
            DispatchQueue.main.async {
                guard let s = state, s.selectedAdmin != tab else { return }
                s.selectedAdmin = tab
            }
        }
        self.onModeChange = { [weak state] mode in
            DispatchQueue.main.async {
                guard let s = state, s.mode != mode else { return }
                s.mode = mode
            }
        }
        self.onBadge = { [weak state] count in
            DispatchQueue.main.async { state?.cartBadge = count }
        }
    }

    /// Find the WKWebView that CAPBridgeViewController created, install the
    /// JS bridge once. Retries with a small backoff because Capacitor builds
    /// its WebView lazily after `viewDidLoad`.
    func attemptInstallHandlers() {
        if handlersInstalled { return }

        guard let wv = findWebView(in: vc.view) else {
            print("Bridge: webView not found yet, retrying…")
            DispatchQueue.main.asyncAfter(deadline: .now() + 0.25) { [weak self] in
                self?.attemptInstallHandlers()
            }
            return
        }
        installBridge(on: wv)
    }

    func findWebView(in view: UIView?) -> WKWebView? {
        guard let v = view else { return nil }
        if let wk = v as? WKWebView { return wk }
        for sub in v.subviews {
            if let found = findWebView(in: sub) { return found }
        }
        return nil
    }

    private func installBridge(on wv: WKWebView) {
        print("Bridge: webView found: \(wv)")
        print("Bridge: URL loaded: \(String(describing: wv.url))")

        let uc = wv.configuration.userContentController
        for name in ["cartBadge", "syncTab", "adminMode"] {
            uc.removeScriptMessageHandler(forName: name)
        }
        uc.add(BridgeMsgHandler { [weak self] m in self?.receive(m) }, name: "cartBadge")
        uc.add(BridgeMsgHandler { [weak self] m in self?.receive(m) }, name: "syncTab")
        uc.add(BridgeMsgHandler { [weak self] m in self?.receive(m) }, name: "adminMode")

        uc.addUserScript(WKUserScript(
            source:           bridgeJS,
            injectionTime:    .atDocumentEnd,
            forMainFrameOnly: true
        ))
        wv.evaluateJavaScript(bridgeJS, completionHandler: nil)

        loadObs?.invalidate()
        loadObs = wv.observe(\.isLoading, options: [.new, .old]) { [weak self] webview, change in
            guard
                let self = self,
                change.oldValue == true,
                change.newValue == false
            else { return }
            print("Bridge: WebView finished loading, URL=\(String(describing: webview.url))")
            webview.evaluateJavaScript(self.bridgeJS, completionHandler: nil)
        }

        handlersInstalled = true
        print("Bridge: handlers installed ✓")

        if let t = lastUserTab  { dispatch(userTab: t,  into: wv) }
        if let t = lastAdminTab { dispatch(adminTab: t, into: wv) }
    }

    private func receive(_ msg: WKScriptMessage) {
        switch msg.name {

        case "cartBadge":
            if let n = msg.body as? Int           { onBadge?(n) }
            else if let n = msg.body as? Double   { onBadge?(Int(n)) }
            else if let s = msg.body as? String,
                    let n = Int(s)                { onBadge?(n) }

        case "syncTab":
            guard let s = msg.body as? String else { break }

            if s == "login" || s == "register" {
                onModeChange?(.hidden)
                return
            }

            if s.hasPrefix("admin") {
                onModeChange?(.admin)
                let suffix: String = {
                    if let dash = s.firstIndex(of: "-") {
                        return String(s[s.index(after: dash)...])
                    }
                    return "orders"
                }()
                if let admin = AdminTab(rawValue: suffix) {
                    onAdminTabChange?(admin)
                }
                return
            }

            onModeChange?(.user)
            if let user = AppTab(rawValue: s) {
                onUserTabChange?(user)
            }

        case "adminMode":
            let on: Bool = {
                if let b = msg.body as? Bool   { return b }
                if let n = msg.body as? Int    { return n != 0 }
                if let s = msg.body as? String { return s == "true" || s == "1" }
                return false
            }()
            onModeChange?(on ? .admin : .user)

        default: break
        }
    }

    func dispatchUserTab(_ tab: AppTab) {
        guard tab != lastUserTab else { return }
        lastUserTab = tab
        guard let wv = findWebView(in: vc.view) else { return }
        dispatch(userTab: tab, into: wv)
    }

    func dispatchAdminTab(_ tab: AdminTab) {
        guard tab != lastAdminTab else { return }
        lastAdminTab = tab
        guard let wv = findWebView(in: vc.view) else { return }
        dispatch(adminTab: tab, into: wv)
    }

    private func dispatch(userTab tab: AppTab, into wv: WKWebView) {
        let js = """
        window.dispatchEvent(new CustomEvent('__nativeTabChange', { detail: '\(tab.rawValue)' }));
        """
        wv.evaluateJavaScript(js, completionHandler: nil)
    }

    private func dispatch(adminTab tab: AdminTab, into wv: WKWebView) {
        let js = """
        window.dispatchEvent(new CustomEvent('__nativeAdminTabChange', { detail: '\(tab.rawValue)' }));
        """
        wv.evaluateJavaScript(js, completionHandler: nil)
    }
}

// MARK: - WKScriptMessageHandler shim

private final class BridgeMsgHandler: NSObject, WKScriptMessageHandler {
    private let block: (WKScriptMessage) -> Void
    init(_ block: @escaping (WKScriptMessage) -> Void) { self.block = block }
    func userContentController(_ c: WKUserContentController,
                               didReceive m: WKScriptMessage) {
        block(m)
    }
}
