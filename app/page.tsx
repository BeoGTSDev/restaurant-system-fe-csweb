"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import jsQR from "jsqr";

type Category = { id: number; name: string };
type Product = {
  id: number;
  name: string;
  displayName?: string | null;
  description?: string;
  price: number;
  imageUrl?: string | null;
  categoryId: number;
  category?: { name: string };
  status: string;
  remainingQty?: number | null;
  allergenIngredients?: string[];
};
type Table = { id: number; name: string; status: string; zone?: { name: string } };
type CartItem = Product & { quantity: number; note: string };
type OrderItem = {
  id: number;
  quantity: number;
  price: number;
  note?: string;
  status: string;
  product: Product;
};
type CustomerOrder = { id: number; totalPrice: number; items: OrderItem[] };

const API_BASE = (process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:5000/api").replace(/\/$/, "");
const money = (value: number) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(Number(value || 0));
const productName = (product: Product) => product.displayName || product.name;

function Icon({ name, size = 20 }: { name: string; size?: number }) {
  const paths: Record<string, React.ReactNode> = {
    search: <><circle cx="11" cy="11" r="7" /><path d="m20 20-3.7-3.7" /></>,
    cart: <><path d="M3 4h2l2.3 10.2a2 2 0 0 0 2 1.6h7.9a2 2 0 0 0 2-1.6L21 7H6" /><circle cx="10" cy="20" r="1" /><circle cx="18" cy="20" r="1" /></>,
    plus: <><path d="M12 5v14M5 12h14" /></>,
    minus: <path d="M5 12h14" />,
    close: <path d="M6 6l12 12M18 6 6 18" />,
    leaf: <><path d="M20 4C10 4 5 9 5 16c5 0 10-2 15-12Z" /><path d="M4 20c3-5 7-8 12-11" /></>,
    chevron: <path d="m9 18 6-6-6-6" />,
    back: <path d="m15 18-6-6 6-6" />,
    check: <path d="m5 12 4 4L19 6" />,
    receipt: <><path d="M6 3h12v18l-3-2-3 2-3-2-3 2V3Z" /><path d="M9 8h6M9 12h6" /></>,
  };
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>{paths[name]}</svg>;
}

export default function Home() {
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [table, setTable] = useState<Table | null>(null);
  const [tableId, setTableId] = useState<number | null>(null);
  const [tableSession, setTableSession] = useState("");
  const [sessionError, setSessionError] = useState("");
  const [category, setCategory] = useState("all");
  const [query, setQuery] = useState("");
  const [cart, setCart] = useState<CartItem[]>([]);
  const [selected, setSelected] = useState<Product | null>(null);
  const [cartOpen, setCartOpen] = useState(false);
  const [ordersOpen, setOrdersOpen] = useState(false);
  const [preferencesOpen, setPreferencesOpen] = useState(false);
  const [allergyAsked, setAllergyAsked] = useState(false);
  const [orders, setOrders] = useState<CustomerOrder[]>([]);
  const [allergies, setAllergies] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [toast, setToast] = useState<{ text: string; error?: boolean } | null>(null);

  const notify = (text: string, error = false) => {
    setToast({ text, error });
    window.setTimeout(() => setToast(null), 3500);
  };

  const loadMenu = useCallback(async () => {
    try {
      const [productResponse, categoryResponse] = await Promise.all([
        fetch(`${API_BASE}/products/public`),
        fetch(`${API_BASE}/categories`),
      ]);
      if (!productResponse.ok || !categoryResponse.ok) throw new Error("Unable to load menu");
      const [productJson, categoryJson] = await Promise.all([
        productResponse.json(), categoryResponse.json(),
      ]);
      setProducts(productJson.data || []);
      setCategories(categoryJson.data || []);
    } catch {
      notify("Could not connect to the restaurant server.", true);
    } finally {
      setLoading(false);
    }
  }, []);

  const joinTable = useCallback(async (scannedValue?: string) => {
    const params = new URLSearchParams(window.location.search);
    let qrCode = scannedValue || params.get("qr") || "";
    if (qrCode.includes("?")) {
      try { qrCode = new URL(qrCode).searchParams.get("qr") || ""; } catch { /* scanner may return the raw table code */ }
    }
    if (!qrCode) {
      setSessionError("");
      return;
    }
    try {
      const response = await fetch(`${API_BASE}/tables/customer/session`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ qrCode }),
      });
      const json = await response.json();
      if (!response.ok) throw new Error(json.message || "This table is not open.");
      setTable(json.data.table);
      setTableId(json.data.table.id);
      setTableSession(json.data.token);
      setSessionError("");
      window.history.replaceState({}, "", `?qr=${encodeURIComponent(qrCode)}`);
      setAllergyAsked(false);
      setPreferencesOpen(true);
    } catch (error) {
      setSessionError(error instanceof Error ? error.message : "Unable to join this table.");
    }
  }, []);

  const loadOrders = useCallback(async () => {
    if (!tableId) return;
    try {
      const response = await fetch(`${API_BASE}/orders/customer/table/${tableId}`, {
        headers: { "x-table-session": tableSession },
      });
      if (!response.ok) return;
      const json = await response.json();
      setOrders(json.data?.orders || []);
    } catch { /* keep the last visible state */ }
  }, [tableId, tableSession]);

  useEffect(() => {
    const initialLoad = window.setTimeout(loadMenu, 0);
    return () => window.clearTimeout(initialLoad);
  }, [loadMenu]);
  useEffect(() => {
    const initialJoin = window.setTimeout(joinTable, 0);
    return () => window.clearTimeout(initialJoin);
  }, [joinTable]);
  useEffect(() => {
    if (!tableId || !tableSession) return;
    const initialSync = window.setTimeout(loadOrders, 0);
    const timer = window.setInterval(loadOrders, 5000);
    return () => {
      window.clearTimeout(initialSync);
      window.clearInterval(timer);
    };
  }, [tableId, tableSession, loadOrders]);

  const visibleProducts = useMemo(() => products.filter((product) => {
    if (product.status === "Disabled") return false;
    const matchesCategory = category === "all" || product.categoryId === Number(category);
    const text = `${productName(product)} ${product.description || ""}`.toLowerCase();
    return matchesCategory && text.includes(query.toLowerCase());
  }).sort((a, b) => {
    const rank = (item: Product) => item.status === "Out of Stock" || item.remainingQty === 0 ? 2 : item.remainingQty != null ? 1 : 0;
    return rank(a) - rank(b) || productName(a).localeCompare(productName(b));
  }), [products, category, query]);

  const matchingAllergies = useCallback((product: Product) => {
    const ingredientText = (product.allergenIngredients || []).join(" ").toLowerCase();
    const aliases: Record<string, string[]> = {
      Dairy: ["milk", "cream", "cheese", "butter", "burrata", "parmesan"],
      Gluten: ["wheat", "flour", "bread", "pasta", "noodle"],
      Nuts: ["nut", "almond", "cashew", "peanut", "walnut", "pistachio"],
      Shellfish: ["shrimp", "prawn", "crab", "lobster", "clam", "mussel", "oyster", "calamari"],
      Eggs: ["egg", "mayonnaise"],
    };
    return allergies.filter(allergy => (aliases[allergy] || []).some(term => ingredientText.includes(term)));
  }, [allergies]);

  const cartCount = cart.reduce((sum, item) => sum + item.quantity, 0);
  const cartTotal = cart.reduce((sum, item) => sum + Number(item.price) * item.quantity, 0);
  const add = (product: Product, quantity = 1, note = "") => {
    if (product.status !== "In Stock" || product.remainingQty === 0) {
      notify(`${productName(product)} is sold out today.`, true);
      return;
    }
    setCart((current) => {
      const existing = current.find((item) => item.id === product.id);
      const nextQty = (existing?.quantity || 0) + quantity;
      if (product.remainingQty != null && nextQty > product.remainingQty) {
        notify(`Only ${product.remainingQty} portions left today.`, true);
        return current;
      }
      return existing
        ? current.map((item) => item.id === product.id ? { ...item, quantity: nextQty, note: note || item.note } : item)
        : [...current, { ...product, quantity, note }];
    });
    setSelected(null);
    notify(`${productName(product)} added to your order.`);
  };

  const updateQuantity = (id: number, delta: number) => {
    setCart((current) => current.flatMap((item) => {
      if (item.id !== id) return [item];
      const quantity = item.quantity + delta;
      if (quantity <= 0) return [];
      if (item.remainingQty != null && quantity > item.remainingQty) {
        notify(`Only ${item.remainingQty} portions left today.`, true);
        return [item];
      }
      return [{ ...item, quantity }];
    }));
  };

  const placeOrder = async () => {
    if (!tableId || !tableSession) return notify("Scan your table QR code before ordering.", true);
    if (!cart.length) return;
    setSending(true);
    try {
      const response = await fetch(`${API_BASE}/orders/customer`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-table-session": tableSession },
        body: JSON.stringify({
          tableId,
          items: cart.map((item) => ({
            productId: item.id,
            quantity: item.quantity,
            note: [item.note, allergies.length ? `Dietary alert: ${allergies.join(", ")}` : ""].filter(Boolean).join(" · "),
          })),
        }),
      });
      const json = await response.json();
      if (!response.ok) throw new Error(json.message || "Order could not be sent");
      setCart([]);
      setCartOpen(false);
      setOrdersOpen(true);
      await Promise.all([loadMenu(), loadOrders()]);
      notify("Order sent to the kitchen and POS.");
    } catch (error) {
      notify(error instanceof Error ? error.message : "Order could not be sent", true);
    } finally {
      setSending(false);
    }
  };

  if (!tableSession || !table) {
    return <QrScanner
      error={sessionError}
      onScan={value => joinTable(value)}
      onRetry={() => setSessionError("")}
    />;
  }

  return (
    <main>
      <header className="topbar">
        <a className="brand" href="#top" aria-label="Maison Lucas home">
          <span className="brandMark">MR</span>
          <span><b>MAISON LUCAS</b><small>Restaurant & Wine</small></span>
        </a>
        <nav>
          <a className="active" href="#menu">Menu</a>
          <button onClick={() => setPreferencesOpen(true)}>Dietary preferences</button>
          <button onClick={() => { setOrdersOpen(true); loadOrders(); }}>My order</button>
        </nav>
        <div className="headerActions">
          <div className="tablePicker"><span>{table ? table.name : sessionError ? "QR required" : "Joining table..."}</span></div>
          <button className="cartButton" onClick={() => setCartOpen(true)} aria-label="Open cart">
            <Icon name="cart" /><span>Cart</span>{cartCount > 0 && <em>{cartCount}</em>}
          </button>
        </div>
      </header>

      <section className="hero" id="top">
        <div className="heroContent">
          <p className="eyebrow">CHEF&apos;S SELECTION · TODAY</p>
          <h1>An evening made<br />to be <i>savoured.</i></h1>
          <p>Season-led dishes, thoughtfully sourced and prepared with a touch of French soul.</p>
          <a className="primaryButton" href="#menu">Explore today&apos;s menu <Icon name="chevron" size={18} /></a>
        </div>
        <div className="heroPlate" aria-hidden>
          <div className="plate"><span>✦</span></div>
          <p>THE SOMMELIER&apos;S PAIRING</p>
        </div>
      </section>

      <section className="menuSection" id="menu">
        <div className="sectionHeading">
          <div><p className="eyebrow">OUR MENU</p><h2>Choose your favourites</h2></div>
          <div className="search"><Icon name="search" /><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search dishes..." /></div>
        </div>
        <div className="categoryRow">
          <button className={category === "all" ? "active" : ""} onClick={() => setCategory("all")}>All dishes</button>
          {categories.map((item) => <button key={item.id} className={category === String(item.id) ? "active" : ""} onClick={() => setCategory(String(item.id))}>{item.name}</button>)}
        </div>

        {loading ? <div className="loadingGrid">{[1,2,3,4,5,6].map((n) => <div className="skeleton" key={n} />)}</div> :
          <div className="menuGrid">
            {visibleProducts.map((product, index) => {
              const soldOut = product.status !== "In Stock" || product.remainingQty === 0;
              const allergyMatches = matchingAllergies(product);
              return <article className={`dishCard ${soldOut ? "soldOut" : ""}`} key={product.id} onClick={() => !soldOut && setSelected(product)}>
                <div className={`dishImage tone${index % 6}`} style={product.imageUrl ? { backgroundImage: `url("${product.imageUrl}")` } : undefined}>
                  {!product.imageUrl && <span>{["✦","❦","◇","✧","◈","❧"][index % 6]}</span>}
                  {product.remainingQty != null && <strong className="stockBadge">{product.remainingQty}<small>LEFT</small></strong>}
                  {soldOut && <span className="soldBadge">SOLD OUT TODAY</span>}
                  {!!allergyMatches.length && <span className="allergyRibbon">ALLERGY · {allergyMatches.join(" / ")}</span>}
                </div>
                <div className="dishBody">
                  <p className="dishCategory">{product.category?.name || "Chef's selection"}</p>
                  <h3>{productName(product)}</h3>
                  <p>{product.description || "Prepared to order with the finest seasonal ingredients."}</p>
                  <div><b>{money(product.price)}</b><button disabled={soldOut} aria-label={`Add ${productName(product)}`} onClick={(event) => { event.stopPropagation(); add(product); }}><Icon name="plus" /></button></div>
                </div>
              </article>;
            })}
          </div>}
      </section>

      <section className="promise">
        <Icon name="leaf" size={28} /><div><p className="eyebrow">OUR PROMISE</p><h2>Good food begins with good ingredients.</h2></div>
        <p>We work with local growers and trusted producers to bring every plate to life.</p>
      </section>

      <footer><span>MAISON LUCAS</span><p>Please tell your server about any allergies. Prices include applicable taxes.</p><b>{table ? `Ordering for ${table.name}` : "Select your table to begin"}</b></footer>

      {selected && <ItemModal product={selected} onClose={() => setSelected(null)} onAdd={add} />}
      {cartOpen && <Drawer title="Your order" subtitle={table?.name || "No table selected"} onClose={() => setCartOpen(false)}>
        {!cart.length ? <Empty icon="cart" title="Your cart is empty" text="Explore the menu and add something delicious." /> :
          <>
            <div className="cartList">{cart.map((item) => <div className="cartItem" key={item.id}>
              <div><h4>{productName(item)}</h4><p>{money(item.price)} each</p></div>
              <div className="stepper"><button onClick={() => updateQuantity(item.id, -1)}><Icon name="minus" size={16} /></button><b>{item.quantity}</b><button onClick={() => updateQuantity(item.id, 1)}><Icon name="plus" size={16} /></button></div>
              <strong>{money(item.price * item.quantity)}</strong>
            </div>)}</div>
            <button className="dietAlert" onClick={() => setPreferencesOpen(true)}><Icon name="leaf" /><span><b>Dietary preferences</b><small>{allergies.length ? allergies.join(", ") : "Add allergies or dietary needs"}</small></span><Icon name="chevron" /></button>
            <div className="cartFooter"><div><span>Total</span><strong>{money(cartTotal)}</strong></div><button className="primaryButton full" disabled={sending} onClick={placeOrder}>{sending ? "Sending..." : "Place order"} <Icon name="chevron" /></button></div>
          </>}
      </Drawer>}

      {ordersOpen && <Drawer title="My order" subtitle={table?.name || "Select a table"} onClose={() => setOrdersOpen(false)}>
        {!orders.length ? <Empty icon="receipt" title="No active order" text="Items you send to the kitchen will appear here." /> :
          <div className="orderList">{orders.flatMap((order) => order.items.map((item) => <div className="orderItem" key={item.id}>
            <span>{item.quantity}</span><div><h4>{productName(item.product)}</h4><p>{item.note || "No special request"}</p></div><em>{item.status}</em><strong>{money(item.price * item.quantity)}</strong>
          </div>))}<div className="orderTotal"><span>Current total</span><b>{money(orders.reduce((sum, order) => sum + Number(order.totalPrice), 0))}</b></div></div>}
      </Drawer>}

      {preferencesOpen && <Preferences selected={allergies} required={!allergyAsked} onClose={() => allergyAsked && setPreferencesOpen(false)} onSave={(items) => { setAllergies(items); setAllergyAsked(true); setPreferencesOpen(false); notify(items.length ? "Allergy alerts are now shown on matching dishes." : "No allergies selected."); }} />}
      {toast && <div className={`toast ${toast.error ? "error" : ""}`}><Icon name={toast.error ? "close" : "check"} />{toast.text}</div>}
    </main>
  );
}

function ItemModal({ product, onClose, onAdd }: { product: Product; onClose: () => void; onAdd: (p: Product, q: number, note: string) => void }) {
  const [quantity, setQuantity] = useState(1);
  const [note, setNote] = useState("");
  return <div className="overlay" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
    <div className="itemModal">
      <button className="closeButton" onClick={onClose}><Icon name="close" /></button>
      <div className="modalImage" style={product.imageUrl ? { backgroundImage: `url("${product.imageUrl}")` } : undefined}><span>✦</span></div>
      <div className="modalBody"><p className="eyebrow">{product.category?.name || "CHEF'S SELECTION"}</p><h2>{productName(product)}</h2><p>{product.description}</p>
        {product.remainingQty != null && <div className="remaining"><b>{product.remainingQty}</b><span>portions<br />left today</span></div>}
        <label>Special request<textarea value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. sauce on the side" /></label>
        <div className="modalAction"><div className="stepper large"><button onClick={() => setQuantity(Math.max(1, quantity - 1))}><Icon name="minus" /></button><b>{quantity}</b><button onClick={() => setQuantity(Math.min(product.remainingQty ?? 99, quantity + 1))}><Icon name="plus" /></button></div>
          <button className="primaryButton" onClick={() => onAdd(product, quantity, note)}>Add · {money(product.price * quantity)}</button></div>
      </div>
    </div>
  </div>;
}

function Drawer({ title, subtitle, onClose, children }: { title: string; subtitle: string; onClose: () => void; children: React.ReactNode }) {
  return <div className="overlay drawerOverlay" onMouseDown={(e) => e.target === e.currentTarget && onClose()}><aside className="drawer">
    <div className="drawerHead"><div><p>{subtitle}</p><h2>{title}</h2></div><button className="closeButton" onClick={onClose}><Icon name="close" /></button></div>{children}
  </aside></div>;
}

function Empty({ icon, title, text }: { icon: string; title: string; text: string }) {
  return <div className="empty"><span><Icon name={icon} size={32} /></span><h3>{title}</h3><p>{text}</p></div>;
}

function Preferences({ selected, required, onClose, onSave }: { selected: string[]; required?: boolean; onClose: () => void; onSave: (items: string[]) => void }) {
  const choices = ["Dairy", "Gluten", "Nuts", "Shellfish", "Eggs", "Vegan", "Vegetarian"];
  const [items, setItems] = useState(selected);
  return <div className="overlay"><div className="preferences">
    {!required && <button className="closeButton" onClick={onClose}><Icon name="close" /></button>}<span className="preferenceIcon"><Icon name="leaf" size={32} /></span>
    <p className="eyebrow">BEFORE YOU ORDER</p><h2>Let us take care of you.</h2><p>Select any allergies or dietary preferences. We&apos;ll attach them to every item in your order.</p>
    <div className="choiceGrid">{choices.map((choice) => <button key={choice} className={items.includes(choice) ? "active" : ""} onClick={() => setItems((list) => list.includes(choice) ? list.filter((x) => x !== choice) : [...list, choice])}>{items.includes(choice) && <Icon name="check" size={16} />}{choice}</button>)}</div>
    <button className="primaryButton full" onClick={() => onSave(items)}>Save preferences</button><button className="textButton" onClick={() => onSave([])}>No dietary preferences</button>
  </div></div>;
}

function QrScanner({ error, onScan, onRetry }: { error: string; onScan: (value: string) => void; onRetry: () => void }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [cameraError, setCameraError] = useState("");
  const [manualCode, setManualCode] = useState("");

  useEffect(() => {
    let stream: MediaStream | null = null;
    let timer = 0;
    let stopped = false;
    const start = async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: "environment" } }, audio: false });
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
        }
        const Detector = (window as unknown as { BarcodeDetector?: new (options: { formats: string[] }) => { detect: (source: HTMLVideoElement) => Promise<Array<{ rawValue: string }>> } }).BarcodeDetector;
        const detector = Detector ? new Detector({ formats: ["qr_code"] }) : null;
        const canvas = document.createElement("canvas");
        const context = canvas.getContext("2d", { willReadFrequently: true });
        const scan = async () => {
          if (stopped || !videoRef.current) return;
          try {
            let value = "";
            if (detector) {
              const codes = await detector.detect(videoRef.current);
              value = codes[0]?.rawValue || "";
            } else if (context && videoRef.current.videoWidth && videoRef.current.videoHeight) {
              const video = videoRef.current;
              const maxWidth = 720;
              const scale = Math.min(1, maxWidth / video.videoWidth);
              canvas.width = Math.max(1, Math.round(video.videoWidth * scale));
              canvas.height = Math.max(1, Math.round(video.videoHeight * scale));
              context.drawImage(video, 0, 0, canvas.width, canvas.height);
              const frame = context.getImageData(0, 0, canvas.width, canvas.height);
              value = jsQR(frame.data, frame.width, frame.height, { inversionAttempts: "attemptBoth" })?.data || "";
            }
            if (value) {
              stopped = true;
              onScan(value);
              return;
            }
          } catch { /* continue scanning the next frame */ }
          timer = window.setTimeout(scan, 250);
        };
        scan();
      } catch {
        setCameraError("Camera access is required to scan your table QR code.");
      }
    };
    start();
    return () => {
      stopped = true;
      window.clearTimeout(timer);
      stream?.getTracks().forEach(track => track.stop());
    };
  }, [onScan]);

  return <main className="scannerPage">
    <section className="scannerCard">
      <div className="scannerBrand">ML</div>
      <p className="eyebrow">MAISON LUCAS · TABLE ORDERING</p>
      <h1>Scan your table</h1>
      <p>Your table must be opened by our team before the QR can start an ordering session.</p>
      <div className="cameraFrame">
        <video ref={videoRef} muted playsInline />
        <div className="scanCorners" />
        <span>Place the table QR inside the frame</span>
      </div>
      {(error || cameraError) && <div className="scanError"><b>{error || cameraError}</b>{error && <button onClick={onRetry}>Scan again</button>}</div>}
      <details>
        <summary>Enter table code manually</summary>
        <div className="manualQr"><input value={manualCode} onChange={event => setManualCode(event.target.value)} placeholder="Table QR code" /><button onClick={() => manualCode.trim() && onScan(manualCode.trim())}>Join table</button></div>
      </details>
    </section>
  </main>;
}
