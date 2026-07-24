"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

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
  const [tables, setTables] = useState<Table[]>([]);
  const [tableId, setTableId] = useState<number | null>(null);
  const [category, setCategory] = useState("all");
  const [query, setQuery] = useState("");
  const [cart, setCart] = useState<CartItem[]>([]);
  const [selected, setSelected] = useState<Product | null>(null);
  const [cartOpen, setCartOpen] = useState(false);
  const [ordersOpen, setOrdersOpen] = useState(false);
  const [preferencesOpen, setPreferencesOpen] = useState(false);
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
      const [productResponse, categoryResponse, tableResponse] = await Promise.all([
        fetch(`${API_BASE}/products`),
        fetch(`${API_BASE}/categories`),
        fetch(`${API_BASE}/tables`),
      ]);
      if (!productResponse.ok || !categoryResponse.ok || !tableResponse.ok) throw new Error("Unable to load menu");
      const [productJson, categoryJson, tableJson] = await Promise.all([
        productResponse.json(), categoryResponse.json(), tableResponse.json(),
      ]);
      setProducts(productJson.data || []);
      setCategories(categoryJson.data || []);
      setTables(tableJson.data || []);
      const fromUrl = Number(new URLSearchParams(window.location.search).get("table"));
      const stored = Number(window.localStorage.getItem("customer-table-id"));
      const chosen = [fromUrl, stored].find((id) => id && (tableJson.data || []).some((t: Table) => t.id === id));
      if (chosen) setTableId(chosen);
    } catch {
      notify("Could not connect to the restaurant server.", true);
    } finally {
      setLoading(false);
    }
  }, []);

  const loadOrders = useCallback(async () => {
    if (!tableId) return;
    try {
      const response = await fetch(`${API_BASE}/orders/customer/table/${tableId}`);
      if (!response.ok) return;
      const json = await response.json();
      setOrders(json.data?.orders || []);
    } catch { /* keep the last visible state */ }
  }, [tableId]);

  useEffect(() => {
    const initialLoad = window.setTimeout(loadMenu, 0);
    return () => window.clearTimeout(initialLoad);
  }, [loadMenu]);
  useEffect(() => {
    if (!tableId) return;
    window.localStorage.setItem("customer-table-id", String(tableId));
    const initialSync = window.setTimeout(loadOrders, 0);
    const timer = window.setInterval(loadOrders, 5000);
    return () => {
      window.clearTimeout(initialSync);
      window.clearInterval(timer);
    };
  }, [tableId, loadOrders]);

  const visibleProducts = useMemo(() => products.filter((product) => {
    if (product.status === "Disabled") return false;
    const matchesCategory = category === "all" || product.categoryId === Number(category);
    const text = `${productName(product)} ${product.description || ""}`.toLowerCase();
    return matchesCategory && text.includes(query.toLowerCase());
  }), [products, category, query]);

  const cartCount = cart.reduce((sum, item) => sum + item.quantity, 0);
  const cartTotal = cart.reduce((sum, item) => sum + Number(item.price) * item.quantity, 0);
  const table = tables.find((item) => item.id === tableId);

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
    if (!tableId) return notify("Select your table before ordering.", true);
    if (!cart.length) return;
    setSending(true);
    try {
      const response = await fetch(`${API_BASE}/orders/customer`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
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
          <label className="tablePicker">
            <span>{table ? table.name : "Select table"}</span>
            <select value={tableId || ""} onChange={(event) => setTableId(Number(event.target.value) || null)}>
              <option value="">Choose your table</option>
              {tables.map((item) => <option key={item.id} value={item.id}>{item.name} · {item.zone?.name || "Dining room"}</option>)}
            </select>
          </label>
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
              return <article className={`dishCard ${soldOut ? "soldOut" : ""}`} key={product.id} onClick={() => !soldOut && setSelected(product)}>
                <div className={`dishImage tone${index % 6}`} style={product.imageUrl ? { backgroundImage: `url("${product.imageUrl}")` } : undefined}>
                  {!product.imageUrl && <span>{["✦","❦","◇","✧","◈","❧"][index % 6]}</span>}
                  {product.remainingQty != null && <strong className="stockBadge">{product.remainingQty}<small>LEFT</small></strong>}
                  {soldOut && <span className="soldBadge">SOLD OUT TODAY</span>}
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

      {preferencesOpen && <Preferences selected={allergies} onClose={() => setPreferencesOpen(false)} onSave={(items) => { setAllergies(items); setPreferencesOpen(false); notify("Dietary preferences saved."); }} />}
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

function Preferences({ selected, onClose, onSave }: { selected: string[]; onClose: () => void; onSave: (items: string[]) => void }) {
  const choices = ["Dairy", "Gluten", "Nuts", "Shellfish", "Eggs", "Vegan", "Vegetarian"];
  const [items, setItems] = useState(selected);
  return <div className="overlay"><div className="preferences">
    <button className="closeButton" onClick={onClose}><Icon name="close" /></button><span className="preferenceIcon"><Icon name="leaf" size={32} /></span>
    <p className="eyebrow">BEFORE YOU ORDER</p><h2>Let us take care of you.</h2><p>Select any allergies or dietary preferences. We&apos;ll attach them to every item in your order.</p>
    <div className="choiceGrid">{choices.map((choice) => <button key={choice} className={items.includes(choice) ? "active" : ""} onClick={() => setItems((list) => list.includes(choice) ? list.filter((x) => x !== choice) : [...list, choice])}>{items.includes(choice) && <Icon name="check" size={16} />}{choice}</button>)}</div>
    <button className="primaryButton full" onClick={() => onSave(items)}>Save preferences</button><button className="textButton" onClick={() => onSave([])}>No dietary preferences</button>
  </div></div>;
}
