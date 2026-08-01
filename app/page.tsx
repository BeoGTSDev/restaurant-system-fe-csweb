"use client";
import ThemeSwitcher from "./ThemeSwitcher";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import jsQR from "jsqr";
import { categoryName, extraCopy, tr, type Language } from "./i18n";

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
type Table = { id: number; name: string; status: string; zone?: { name: string }; guestLanguage?: Language | null; guestAllergies?: string[] };
type CartItem = Product & { quantity: number; note: string };
type SePayPayment = {
  reference: string;
  amount: number;
  status: "Pending" | "Paid" | "Failed" | "Expired";
  expiresAt: string;
  accountNumber: string;
  accountName: string;
  qrUrl: string;
  clientToken: string;
  failureReason?: string;
  receiptId?: number;
};
type OrderItem = {
  id: number;
  quantity: number;
  price: number;
  note?: string;
  status: string;
  product: Product;
};
type CustomerOrder = { id: number; totalPrice: number; items: OrderItem[] };
type BillSnapshot = {
  subtotal: number;
  voucherCode?: string | null;
  voucherDiscountAmount: number;
  billDiscountPercent: number;
  billDiscountAmount: number;
  billDiscountReason?: string | null;
  discountAmount: number;
  discountedSubtotal: number;
  foodVatAmount: number;
  alcoholVatAmount: number;
  serviceChargeAmount: number;
  serviceChargeName?: string | null;
  totalAmount: number;
};
const API_BASE = (process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:5000/api").replace(/\/$/, "");
const locales: Record<Language, string> = { en: "en-US", vi: "vi-VN", fr: "fr-FR", zh: "zh-CN", ja: "ja-JP", ko: "ko-KR", th: "th-TH", ru: "ru-RU" };
const money = (value: number, language: Language = "en") =>
  new Intl.NumberFormat(locales[language], { style: "currency", currency: "VND", maximumFractionDigits: 0 }).format(Number(value || 0));
const productName = (product: Product) => product.displayName || product.name;
const languages: Array<{ code: Language; label: string }> = [
  { code: "th", label: "ไทย" },
  { code: "ru", label: "Русский" },
  { code: "en", label: "English" },
  { code: "vi", label: "Tiếng Việt" },
  { code: "fr", label: "Français" },
  { code: "zh", label: "中文" },
  { code: "ja", label: "日本語" },
  { code: "ko", label: "한국어" },
];
const copy: Record<Language, Record<string, string>> = {
  en: { welcome: "Welcome to Maison Lucas", welcomeText: "Your table is ready. Take a moment, settle in, and let us take care of the rest.", continue: "Begin your experience", menu: "Menu", dietary: "Dietary preferences", myOrder: "My order", cart: "Cart", timeout: "Your session ended after 5 minutes of inactivity. Scan the table QR again to continue.", voucherQuestion: "Do you have a voucher?", noVoucher: "Continue without voucher", apply: "Apply voucher", amountDue: "Amount due", pay: "Pay by bank transfer" },
  vi: { welcome: "Chào mừng đến Maison Lucas", welcomeText: "Bàn của quý khách đã sẵn sàng. Hãy thư giãn và để chúng tôi chăm sóc trải nghiệm của quý khách.", continue: "Bắt đầu trải nghiệm", menu: "Thực đơn", dietary: "Dị ứng & chế độ ăn", myOrder: "Món đã gọi", cart: "Giỏ món", timeout: "Phiên đã kết thúc sau 5 phút không hoạt động. Vui lòng quét lại mã QR của bàn.", voucherQuestion: "Quý khách có voucher không?", noVoucher: "Tiếp tục không dùng voucher", apply: "Áp dụng voucher", amountDue: "Tổng thanh toán", pay: "Thanh toán chuyển khoản" },
  fr: { welcome: "Bienvenue chez Maison Lucas", welcomeText: "Votre table est prête. Installez-vous, nous nous occupons du reste.", continue: "Commencer l’expérience", menu: "Menu", dietary: "Allergies", myOrder: "Ma commande", cart: "Panier", timeout: "Votre session a expiré après 5 minutes d’inactivité. Scannez à nouveau le QR.", voucherQuestion: "Avez-vous un bon ?", noVoucher: "Continuer sans bon", apply: "Appliquer", amountDue: "Montant dû", pay: "Payer par virement" },
  zh: { welcome: "欢迎来到 Maison Lucas", welcomeText: "您的餐桌已经准备好。请放松享受，让我们为您服务。", continue: "开始用餐体验", menu: "菜单", dietary: "过敏与饮食偏好", myOrder: "已点菜品", cart: "购物车", timeout: "由于 5 分钟未操作，会话已结束。请重新扫描餐桌二维码。", voucherQuestion: "您有优惠券吗？", noVoucher: "无优惠券继续", apply: "使用优惠券", amountDue: "应付金额", pay: "银行转账支付" },
  ja: { welcome: "Maison Lucas へようこそ", welcomeText: "お席の準備が整いました。どうぞゆっくりお過ごしください。", continue: "お食事を始める", menu: "メニュー", dietary: "アレルギー", myOrder: "注文履歴", cart: "カート", timeout: "5分間操作がなかったため終了しました。QRコードを再度読み取ってください。", voucherQuestion: "クーポンはありますか？", noVoucher: "クーポンなしで続行", apply: "適用", amountDue: "お支払い金額", pay: "銀行振込で支払う" },
  ko: { welcome: "Maison Lucas에 오신 것을 환영합니다", welcomeText: "테이블이 준비되었습니다. 편안히 즐겨 주세요.", continue: "식사 시작하기", menu: "메뉴", dietary: "알레르기", myOrder: "주문 내역", cart: "장바구니", timeout: "5분 동안 활동이 없어 세션이 종료되었습니다. 테이블 QR을 다시 스캔해 주세요.", voucherQuestion: "바우처가 있으신가요?", noVoucher: "바우처 없이 계속", apply: "적용", amountDue: "결제 금액", pay: "계좌이체 결제" },
  th: { welcome: "ยินดีต้อนรับสู่ Maison Lucas", welcomeText: "โต๊ะของคุณพร้อมแล้ว พักผ่อนและให้เราดูแลคุณ", continue: "เริ่มประสบการณ์", menu: "เมนู", dietary: "ข้อมูลการแพ้อาหาร", myOrder: "รายการที่สั่ง", cart: "ตะกร้า", timeout: "เซสชันสิ้นสุดหลังจากไม่มีการใช้งาน 5 นาที โปรดสแกน QR อีกครั้ง", voucherQuestion: "คุณมีคูปองหรือไม่?", noVoucher: "ดำเนินการต่อโดยไม่มีคูปอง", apply: "ใช้คูปอง", amountDue: "ยอดที่ต้องชำระ", pay: "ชำระด้วยการโอนเงิน" },
  ru: { welcome: "Добро пожаловать в Maison Lucas", welcomeText: "Ваш стол готов. Располагайтесь, мы позаботимся об остальном.", continue: "Начать", menu: "Меню", dietary: "Аллергии", myOrder: "Мой заказ", cart: "Корзина", timeout: "Сеанс завершён после 5 минут бездействия. Отсканируйте QR-код снова.", voucherQuestion: "У вас есть ваучер?", noVoucher: "Продолжить без ваучера", apply: "Применить", amountDue: "К оплате", pay: "Оплатить переводом" },
};
const uiCopy: Record<Language, Record<string, string>> = {
  en: { hero: "Enjoy a relaxed evening at Maison Lucas.", heroText: "Seasonal dishes, prepared with care and served in a warm, French-inspired setting.", explore: "Browse the menu", choose: "Pick what you like", search: "Search dishes...", all: "All dishes", promise: "Great food starts with thoughtful ingredients.", emptyCart: "Your cart is empty", emptyOrder: "No active order", placeOrder: "Place order", total: "Total", allergiesTitle: "Let us take care of you.", allergiesText: "Select every food allergy that applies. We will sync it with the POS and attach it to your order.", save: "Save allergy information", none: "No known food allergies" },
  vi: { hero: "Tận hưởng một buổi tối thư giãn tại Maison Lucas.", heroText: "Món ăn theo mùa, được chế biến tỉ mỉ và phục vụ trong không gian ấm áp, lấy cảm hứng từ Pháp.", explore: "Xem thực đơn", choose: "Chọn món bạn thích", search: "Tìm món...", all: "Tất cả món", promise: "Món ngon bắt đầu từ nguyên liệu được chọn kỹ.", emptyCart: "Giỏ món đang trống", emptyOrder: "Chưa có món đã gọi", placeOrder: "Gửi món", total: "Tổng cộng", allergiesTitle: "Hãy để chúng tôi chăm sóc quý khách.", allergiesText: "Chọn tất cả dị ứng thực phẩm. Thông tin sẽ được đồng bộ với POS và gắn vào đơn.", save: "Lưu thông tin dị ứng", none: "Không có dị ứng đã biết" },
  fr: { hero: "Profitez d'une soirée détendue chez Maison Lucas.", heroText: "Des plats de saison, préparés avec soin et servis dans une ambiance chaleureuse.", explore: "Voir le menu", choose: "Choisir vos plats", search: "Rechercher un plat...", all: "Tous les plats", promise: "Un bon repas commence par des ingrédients soignés.", emptyCart: "Votre panier est vide", emptyOrder: "Aucune commande active", placeOrder: "Commander", total: "Total", allergiesTitle: "Prenons soin de vous.", allergiesText: "Sélectionnez toutes vos allergies. Elles seront synchronisées avec le POS.", save: "Enregistrer les allergies", none: "Aucune allergie connue" },
  zh: { hero: "在 Maison Lucas 享受轻松的夜晚。", heroText: "时令美食，精心烹制，配以温暖的法国风情。", explore: "查看菜单", choose: "选择您喜欢的菜品", search: "搜索菜品...", all: "全部菜品", promise: "好食材，成就好味道。", emptyCart: "购物车为空", emptyOrder: "暂无已点菜品", placeOrder: "提交订单", total: "合计", allergiesTitle: "让我们更好地照顾您。", allergiesText: "请选择所有食物过敏项，信息将同步至 POS。", save: "保存过敏信息", none: "无已知食物过敏" },
  ja: { hero: "Maison Lucas でゆったりした夜をお楽しみください。", heroText: "旬の食材を丁寧に仕上げ、温かな雰囲気でお出しします。", explore: "メニューを見る", choose: "お好きな料理を選ぶ", search: "料理を検索...", all: "すべての料理", promise: "良い食材から、良い料理が生まれます。", emptyCart: "カートは空です", emptyOrder: "注文はまだありません", placeOrder: "注文する", total: "合計", allergiesTitle: "安心してお楽しみください。", allergiesText: "該当する食物アレルギーをすべて選択してください。POSと同期します。", save: "アレルギー情報を保存", none: "既知の食物アレルギーなし" },
  ko: { hero: "Maison Lucas에서 편안한 저녁을 보내세요.", heroText: "제철 재료를 정성껏 준비해 따뜻한 분위기 속에 서빙합니다.", explore: "메뉴 보기", choose: "좋아하는 메뉴 선택", search: "메뉴 검색...", all: "전체 메뉴", promise: "좋은 재료가 좋은 음식으로 이어집니다.", emptyCart: "장바구니가 비어 있습니다", emptyOrder: "주문 내역이 없습니다", placeOrder: "주문하기", total: "합계", allergiesTitle: "안전한 식사를 위해 알려 주세요.", allergiesText: "해당하는 식품 알레르기를 모두 선택하세요. POS와 동기화됩니다.", save: "알레르기 정보 저장", none: "알려진 식품 알레르기 없음" },
  th: { hero: "เพลิดเพลินกับค่ำคืนที่ผ่อนคลายที่ Maison Lucas", heroText: "เมนูตามฤดูกาลที่ปรุงด้วยความเอาใจใส่ และเสิร์ฟในบรรยากาศอบอุ่นที่ได้รับแรงบันดาลใจจากฝรั่งเศส", explore: "ดูเมนู", choose: "เลือกเมนูที่คุณชอบ", search: "ค้นหาอาหาร...", all: "อาหารทั้งหมด", promise: "อาหารที่ดีเริ่มจากวัตถุดิบที่คัดสรรมาอย่างดี", emptyCart: "ตะกร้าว่าง", emptyOrder: "ยังไม่มีรายการสั่ง", placeOrder: "ส่งคำสั่งซื้อ", total: "รวม", allergiesTitle: "ให้เราดูแลคุณ", allergiesText: "เลือกการแพ้อาหารทั้งหมด ข้อมูลจะซิงค์กับ POS", save: "บันทึกข้อมูลการแพ้", none: "ไม่มีการแพ้อาหารที่ทราบ" },
  ru: { hero: "Проведите спокойный вечер в Maison Lucas.", heroText: "Сезонные блюда, тщательно приготовленные и поданные в тёплой атмосфере с французским настроением.", explore: "Открыть меню", choose: "Выберите любимые блюда", search: "Найти блюдо...", all: "Все блюда", promise: "Хорошее блюдо начинается с хороших ингредиентов.", emptyCart: "Корзина пуста", emptyOrder: "Активных заказов нет", placeOrder: "Отправить заказ", total: "Итого", allergiesTitle: "Позвольте нам позаботиться о вас.", allergiesText: "Выберите все пищевые аллергии. Информация будет синхронизирована с POS.", save: "Сохранить аллергии", none: "Нет известных пищевых аллергий" },
};

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
  const [serviceOpen, setServiceOpen] = useState(false);
  const [serviceTab, setServiceTab] = useState<"cart" | "orders">("cart");
  const [preferencesOpen, setPreferencesOpen] = useState(false);
  const [allergyAsked, setAllergyAsked] = useState(false);
  const [orders, setOrders] = useState<CustomerOrder[]>([]);
  const [allergies, setAllergies] = useState<string[]>([]);
  const [courseTiming, setCourseTiming] = useState<"ALL_NOW" | "SHARE" | "SAME_TIME">("ALL_NOW");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [payment, setPayment] = useState<SePayPayment | null>(null);
  const [paymentLoading, setPaymentLoading] = useState(false);
  const [bill, setBill] = useState<BillSnapshot | null>(null);
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [welcomeOpen, setWelcomeOpen] = useState(false);
  const [language, setLanguage] = useState<Language>("en");
  const [toast, setToast] = useState<{ text: string; error?: boolean } | null>(null);

  const notify = (text: string, error = false) => {
    setToast({ text, error });
    window.setTimeout(() => setToast(null), 3500);
  };

  const syncGuestPreferences = useCallback(async (nextLanguage: Language, nextAllergies: string[]) => {
    if (!tableSession) return;
    const response = await fetch(`${API_BASE}/tables/customer/preferences`, {
      method: "PUT",
      headers: { "Content-Type": "application/json", "x-table-session": tableSession },
      body: JSON.stringify({ language: nextLanguage, allergies: nextAllergies }),
    });
    const json = await response.json();
    if (!response.ok) throw new Error(json.message || "Could not save guest preferences.");
  }, [tableSession]);

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
      if (json.data.table.guestLanguage && copy[json.data.table.guestLanguage as Language]) {
        setLanguage(json.data.table.guestLanguage as Language);
      }
      setAllergies(json.data.table.guestAllergies || []);
      setTableId(json.data.table.id);
      setTableSession(json.data.token);
      setSessionError("");
      window.history.replaceState({}, "", `?qr=${encodeURIComponent(qrCode)}`);
      setAllergyAsked(false);
      setWelcomeOpen(true);
      setPreferencesOpen(false);
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

  const loadBill = useCallback(async () => {
    if (!tableSession) return null;
    const response = await fetch(`${API_BASE}/payments/customer/bill`, {
      headers: { "x-table-session": tableSession },
    });
    const json = await response.json();
    if (!response.ok) throw new Error(json.message || "Unable to load your bill.");
    setBill(json.data);
    return json.data as BillSnapshot;
  }, [tableSession]);

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

  useEffect(() => {
    if (!checkoutOpen || !tableSession) return;
    const timer = window.setInterval(() => {
      loadBill().catch(() => undefined);
    }, 2500);
    return () => window.clearInterval(timer);
  }, [checkoutOpen, tableSession, loadBill]);

  useEffect(() => {
    if (!tableSession) return;
    let timer = 0;
    const expire = () => {
      setTableSession("");
      setTable(null);
      setTableId(null);
      setCart([]);
      setOrders([]);
      setBill(null);
      setPayment(null);
      setCheckoutOpen(false);
      setWelcomeOpen(false);
      window.history.replaceState({}, "", window.location.pathname);
      setSessionError(copy[language].timeout);
    };
    const reset = () => {
      window.clearTimeout(timer);
      timer = window.setTimeout(expire, 5 * 60 * 1000);
    };
    const events = ["pointerdown", "keydown", "touchstart", "scroll"];
    events.forEach(event => window.addEventListener(event, reset, { passive: true }));
    reset();
    return () => {
      window.clearTimeout(timer);
      events.forEach(event => window.removeEventListener(event, reset));
    };
  }, [tableSession, language]);

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
      Peanuts: ["peanut"],
      "Tree nuts": ["nut", "almond", "cashew", "walnut", "pistachio"],
      Shellfish: ["shrimp", "prawn", "crab", "lobster", "clam", "mussel", "oyster", "calamari"],
      Eggs: ["egg", "mayonnaise"],
      Fish: ["fish", "salmon", "tuna", "anchovy"],
      Soy: ["soy", "tofu"],
      Sesame: ["sesame", "tahini"],
      Mustard: ["mustard"],
      Celery: ["celery"],
      Sulphites: ["sulphite", "sulfite", "wine"],
    };
    return allergies.filter(allergy => (aliases[allergy] || []).some(term => ingredientText.includes(term)));
  }, [allergies]);

  const cartCount = cart.reduce((sum, item) => sum + item.quantity, 0);
  const cartTotal = cart.reduce((sum, item) => sum + Number(item.price) * item.quantity, 0);
  const add = (product: Product, quantity = 1, note = "") => {
    if (product.status !== "In Stock" || product.remainingQty === 0) {
      notify(`${productName(product)} · ${tr(language, "soldOutToday")}`, true);
      return;
    }
    setCart((current) => {
      const existing = current.find((item) => item.id === product.id);
      const nextQty = (existing?.quantity || 0) + quantity;
      if (product.remainingQty != null && nextQty > product.remainingQty) {
        notify(`${product.remainingQty} ${tr(language, "portionsLeft")}`, true);
        return current;
      }
      return existing
        ? current.map((item) => item.id === product.id ? { ...item, quantity: nextQty, note: note || item.note } : item)
        : [...current, { ...product, quantity, note }];
    });
    setSelected(null);
    notify(`${tr(language, "add")}: ${productName(product)}`);
  };

  const updateQuantity = (id: number, delta: number) => {
    setCart((current) => current.flatMap((item) => {
      if (item.id !== id) return [item];
      const quantity = item.quantity + delta;
      if (quantity <= 0) return [];
      if (item.remainingQty != null && quantity > item.remainingQty) {
        notify(`${item.remainingQty} ${tr(language, "portionsLeft")}`, true);
        return [item];
      }
      return [{ ...item, quantity }];
    }));
  };

  const placeOrder = async () => {
    if (!tableId || !tableSession) return notify(tr(language, "scanBeforeOrder"), true);
    if (!cart.length) return;
    setSending(true);
    try {
      const response = await fetch(`${API_BASE}/orders/customer`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-table-session": tableSession },
        body: JSON.stringify({
          tableId,
          courseTiming,
          items: cart.map((item) => ({
            productId: item.id,
            quantity: item.quantity,
            note: [item.note, allergies.length ? `Dietary alert: ${allergies.join(", ")}` : ""].filter(Boolean).join(" · "),
          })),
        }),
      });
      const json = await response.json();
      if (!response.ok) throw new Error(json.message || tr(language, "orderFailed"));
      setCart([]);
      setServiceOpen(true);
      setServiceTab("orders");
      await Promise.all([loadMenu(), loadOrders()]);
      notify(tr(language, "orderSent"));
    } catch (error) {
      notify(error instanceof Error ? error.message : tr(language, "orderFailed"), true);
    } finally {
      setSending(false);
    }
  };

  const startPayment = async () => {
    if (!tableSession) return notify(tr(language, "scanBeforePay"), true);
    setPaymentLoading(true);
    try {
      const response = await fetch(`${API_BASE}/payments/sepay/create`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-table-session": tableSession },
        body: JSON.stringify({ tableId }),
      });
      const json = await response.json();
      if (!response.ok) throw new Error(json.message || tr(language, "paymentCreateFailed"));
      setPayment(json.data);
    } catch (error) {
      notify(error instanceof Error ? error.message : tr(language, "paymentCreateFailed"), true);
    } finally {
      setPaymentLoading(false);
    }
  };

  const openCheckout = async () => {
    try {
      await loadBill();
      setServiceOpen(false);
      setCheckoutOpen(true);
    } catch (error) {
      notify(error instanceof Error ? error.message : tr(language, "billLoadFailed"), true);
    }
  };

  const applyVoucher = async (code: string) => {
    const response = await fetch(`${API_BASE}/payments/customer/voucher`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-table-session": tableSession },
      body: JSON.stringify({ code }),
    });
    const json = await response.json();
    if (!response.ok) throw new Error(json.message || tr(language, "voucherError"));
    setBill(json.data);
    notify(`Voucher ${json.data.voucherCode} applied.`);
  };

  useEffect(() => {
    if (!payment || payment.status !== "Pending") return;
    const timer = window.setInterval(async () => {
      try {
        const response = await fetch(`${API_BASE}/payments/sepay/${encodeURIComponent(payment.reference)}/status?token=${encodeURIComponent(payment.clientToken)}`);
        if (!response.ok) return;
        const json = await response.json();
        const next = json.data;
        setPayment((current) => current ? { ...current, ...next } : current);
        if (next.status === "Paid") {
          setServiceOpen(false);
          notify(tr(language, "paymentConfirmed"));
        }
      } catch { /* keep polling until the payment expires */ }
    }, 2000);
    return () => window.clearInterval(timer);
  }, [payment]);

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
          <span><b>MAISON LUCAS</b><small>{tr(language, "restaurantSubtitle")}</small></span>
        </a>
        <nav>
          <a className="active" href="#menu">{copy[language].menu}</a>
          <button onClick={() => setPreferencesOpen(true)}>{copy[language].dietary}</button>
          <button onClick={() => { setServiceOpen(true); setServiceTab("orders"); loadOrders(); }}>{copy[language].myOrder}</button>
        </nav>
        <div className="headerActions">
          <ThemeSwitcher />
          <select className="languageSelect" value={language} onChange={event => {
            const nextLanguage = event.target.value as Language;
            setLanguage(nextLanguage);
            syncGuestPreferences(nextLanguage, allergies).catch(() => notify(tr(nextLanguage, "syncLanguageError"), true));
          }} aria-label={tr(language, "chooseLanguage")}>
            {languages.map(item => <option value={item.code} key={item.code}>{item.label}</option>)}
          </select>
          <div className="tablePicker"><span>{table ? table.name : sessionError ? tr(language, "qrRequired") : tr(language, "joiningTable")}</span></div>
          <button className="cartButton combinedOrderButton" onClick={() => { setServiceOpen(true); setServiceTab(cartCount ? "cart" : "orders"); loadOrders(); }} aria-label={`${copy[language].cart} / ${copy[language].myOrder}`}>
            <Icon name="cart" /><span>{copy[language].cart} · {copy[language].myOrder}</span>{(cartCount + orders.length) > 0 && <em>{cartCount + orders.length}</em>}
          </button>
        </div>
      </header>

      <section className="hero" id="top">
        <div className="heroContent">
          <p className="eyebrow">{tr(language, "chefToday")}</p>
          <h1>{uiCopy[language].hero}</h1>
          <p>{uiCopy[language].heroText}</p>
          <a className="primaryButton" href="#menu">{uiCopy[language].explore} <Icon name="chevron" size={18} /></a>
        </div>
        <div className="heroPlate" aria-hidden>
          <div className="plate"><span>✦</span></div>
          <p>{tr(language, "pairing")}</p>
        </div>
      </section>

      <section className="menuSection" id="menu">
        <div className="sectionHeading">
          <div><p className="eyebrow">{copy[language].menu}</p><h2>{uiCopy[language].choose}</h2></div>
          <div className="search"><Icon name="search" /><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder={uiCopy[language].search} /></div>
        </div>
        <div className="categoryRow">
          <button className={category === "all" ? "active" : ""} onClick={() => setCategory("all")}>{uiCopy[language].all}</button>
          {categories.map((item) => <button key={item.id} className={category === String(item.id) ? "active" : ""} onClick={() => setCategory(String(item.id))}>{categoryName(language, item.name)}</button>)}
        </div>

        {loading ? <div className="loadingGrid">{[1,2,3,4,5,6].map((n) => <div className="skeleton" key={n} />)}</div> :
          <div className="menuGrid">
            {visibleProducts.map((product, index) => {
              const soldOut = product.status !== "In Stock" || product.remainingQty === 0;
              const allergyMatches = matchingAllergies(product);
              return <article className={`dishCard ${soldOut ? "soldOut" : ""}`} key={product.id} onClick={() => !soldOut && setSelected(product)}>
                <div className={`dishImage tone${index % 6}`} style={product.imageUrl ? { backgroundImage: `url("${product.imageUrl}")` } : undefined}>
                  {!product.imageUrl && <span>{["✦","❦","◇","✧","◈","❧"][index % 6]}</span>}
                  {product.remainingQty != null && <strong className="stockBadge">{product.remainingQty}<small>{tr(language, "left")}</small></strong>}
                  {soldOut && <span className="soldBadge">{tr(language, "soldOutToday")}</span>}
                  {!!allergyMatches.length && <span className="allergyRibbon">{tr(language, "allergy")} · {allergyMatches.map(item => extraCopy[language][item as keyof typeof extraCopy.en] || item).join(" / ")}</span>}
                </div>
                <div className="dishBody">
                  <p className="dishCategory">{categoryName(language, product.category?.name)}</p>
                  <h3>{productName(product)}</h3>
                  <p>{product.description || tr(language, "defaultDescription")}</p>
                  <div><b>{money(product.price, language)}</b><button disabled={soldOut} aria-label={`Add ${productName(product)}`} onClick={(event) => { event.stopPropagation(); add(product); }}><Icon name="plus" /></button></div>
                </div>
              </article>;
            })}
          </div>}
      </section>

      <section className="promise">
        <Icon name="leaf" size={28} /><div><p className="eyebrow">MAISON LUCAS</p><h2>{uiCopy[language].promise}</h2></div>
        <p>{tr(language, "localPromise")}</p>
      </section>

      <footer><span>MAISON LUCAS</span><p>{tr(language, "allergyFooter")}</p><b>{table ? `${tr(language, "orderingFor")} ${table.name}` : tr(language, "selectTable")}</b></footer>

      {selected && <ItemModal product={selected} language={language} onClose={() => setSelected(null)} onAdd={add} />}
      {serviceOpen && <Drawer title={`${copy[language].cart} & ${copy[language].myOrder}`} subtitle={table?.name || tr(language, "noTable")} onClose={() => setServiceOpen(false)}>
        <div className="serviceTabs">
          <button className={serviceTab === "cart" ? "active" : ""} onClick={() => setServiceTab("cart")}><Icon name="cart" />{copy[language].cart}<em>{cartCount}</em></button>
          <button className={serviceTab === "orders" ? "active" : ""} onClick={() => { setServiceTab("orders"); loadOrders(); }}><Icon name="receipt" />{copy[language].myOrder}<em>{orders.reduce((sum, order) => sum + order.items.length, 0)}</em></button>
        </div>
        {serviceTab === "cart" && (!cart.length ? <Empty icon="cart" title={uiCopy[language].emptyCart} text={uiCopy[language].explore} /> :
          <>
            <div className="cartList">{cart.map((item) => <div className="cartItem" key={item.id}>
              <div><h4>{productName(item)}</h4><p>{money(item.price, language)} {tr(language, "each")}</p></div>
              <div className="stepper"><button onClick={() => updateQuantity(item.id, -1)}><Icon name="minus" size={16} /></button><b>{item.quantity}</b><button onClick={() => updateQuantity(item.id, 1)}><Icon name="plus" size={16} /></button></div>
              <strong>{money(item.price * item.quantity, language)}</strong>
            </div>)}</div>
            <button className="dietAlert" onClick={() => setPreferencesOpen(true)}><Icon name="leaf" /><span><b>{copy[language].dietary}</b><small>{allergies.length ? allergies.map(item => extraCopy[language][item as keyof typeof extraCopy.en] || item).join(", ") : tr(language, "addDietary")}</small></span><Icon name="chevron" /></button>
            <div className="courseChoice"><b>{tr(language, "serveDishes")}</b><div>{(["ALL_NOW","SHARE","SAME_TIME"] as const).map(value => <button className={courseTiming === value ? "active" : ""} onClick={() => setCourseTiming(value)} key={value}>{tr(language, value === "ALL_NOW" ? "allNow" : value === "SHARE" ? "share" : "sameTime")}</button>)}</div></div>
            <div className="cartFooter"><div><span>{uiCopy[language].total}</span><strong>{money(cartTotal, language)}</strong></div><button className="primaryButton full" disabled={sending} onClick={placeOrder}>{sending ? "..." : uiCopy[language].placeOrder} <Icon name="chevron" /></button></div>
          </>)}
        {serviceTab === "orders" && (!orders.length ? <Empty icon="receipt" title={uiCopy[language].emptyOrder} text={uiCopy[language].emptyOrder} /> :
          <div className="orderList">{orders.flatMap((order) => order.items.map((item) => <div className="orderItem" key={item.id}>
            <span>{item.quantity}</span><div><h4>{productName(item.product)}</h4><p>{item.note || tr(language, "noRequest")}</p></div><em>{extraCopy[language][item.status.toLowerCase() as keyof typeof extraCopy.en] || item.status}</em><strong>{money(item.price * item.quantity, language)}</strong>
          </div>))}<div className="orderTotal"><span>{tr(language, "currentTotal")}</span><b>{money(orders.reduce((sum, order) => sum + Number(order.totalPrice), 0), language)}</b></div>
            <button className="primaryButton full" disabled={paymentLoading} onClick={openCheckout}>{paymentLoading ? tr(language, "preparingPayment") : copy[language].pay} <Icon name="chevron" /></button>
          </div>)}
      </Drawer>}

      {welcomeOpen && <Welcome tableName={table.name} language={language} onContinue={async nextLanguage => {
        setLanguage(nextLanguage);
        try {
          await syncGuestPreferences(nextLanguage, []);
          setWelcomeOpen(false);
          setPreferencesOpen(true);
        } catch (error) {
          notify(error instanceof Error ? error.message : tr(nextLanguage, "saveLanguageError"), true);
        }
      }} />}
      {checkoutOpen && bill && <CheckoutModal bill={bill} language={language} loading={paymentLoading} onApplyVoucher={applyVoucher} onPay={startPayment} onClose={() => setCheckoutOpen(false)} />}
      {payment && <PaymentModal payment={payment} language={language} onClose={() => payment.status === "Pending" ? setPayment(null) : window.location.assign(window.location.origin)} />}
      {preferencesOpen && <Preferences language={language} selected={allergies} required={!allergyAsked} onClose={() => allergyAsked && setPreferencesOpen(false)} onSave={async items => {
        try {
          await syncGuestPreferences(language, items);
          setAllergies(items);
          setAllergyAsked(true);
          setPreferencesOpen(false);
          notify(items.length ? tr(language, "preferencesSaved") : tr(language, "noAllergiesSelected"));
        } catch (error) {
          notify(error instanceof Error ? error.message : tr(language, "preferenceSaveFailed"), true);
        }
      }} />}
      {toast && <div className={`toast ${toast.error ? "error" : ""}`}><Icon name={toast.error ? "close" : "check"} />{toast.text}</div>}
    </main>
  );
}

function Welcome({ tableName, language, onContinue }: { tableName: string; language: Language; onContinue: (language: Language) => Promise<void> }) {
  const [selectedLanguage, setSelectedLanguage] = useState(language);
  const [stage, setStage] = useState<"welcome" | "language">("welcome");
  const [saving, setSaving] = useState(false);
  const text = copy[selectedLanguage];
  return <div className="welcomeScreen">
    <div className="welcomeGlow" />
    <div className="welcomeOrnament"><span>ML</span></div>
    <p className="eyebrow">MAISON LUCAS · {tableName}</p>
    <h1>{stage === "welcome" ? text.welcome : tr(selectedLanguage, "chooseLanguage")}</h1>
    <p>{stage === "welcome" ? text.welcomeText : tr(selectedLanguage, "chooseLanguageText")}</p>
    {stage === "language" && <div className="welcomeLanguages">{languages.map(item => <button className={selectedLanguage === item.code ? "active" : ""} key={item.code} onClick={() => setSelectedLanguage(item.code)}>{item.label}</button>)}</div>}
    {stage === "welcome"
      ? <button className="primaryButton" onClick={() => setStage("language")}>{text.continue}<Icon name="chevron" /></button>
      : <button className="primaryButton" disabled={saving} onClick={async () => { setSaving(true); await onContinue(selectedLanguage); setSaving(false); }}>{saving ? "..." : text.continue}<Icon name="chevron" /></button>}
    <div className="welcomeSparkles" aria-hidden><i /><i /><i /><i /><i /></div>
  </div>;
}

function CheckoutModal({
  bill,
  language,
  loading,
  onApplyVoucher,
  onPay,
  onClose,
}: {
  bill: BillSnapshot;
  language: Language;
  loading: boolean;
  onApplyVoucher: (code: string) => Promise<void>;
  onPay: () => Promise<void>;
  onClose: () => void;
}) {
  const [voucherCode, setVoucherCode] = useState(bill.voucherCode || "");
  const [showVoucher, setShowVoucher] = useState(Boolean(bill.voucherCode));
  const [voucherDecided, setVoucherDecided] = useState(Boolean(bill.voucherCode));
  const [applying, setApplying] = useState(false);
  const [error, setError] = useState("");
  const text = copy[language];
  const apply = async () => {
    if (!voucherCode.trim()) return;
    setApplying(true);
    setError("");
    try {
      await onApplyVoucher(voucherCode.trim().toUpperCase());
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : tr(language, "voucherError"));
    } finally {
      setApplying(false);
    }
  };
  return <div className="overlay checkoutOverlay" onMouseDown={event => event.target === event.currentTarget && onClose()}>
    <section className="checkoutCard">
      <button className="closeButton" onClick={onClose}><Icon name="close" /></button>
      <p className="eyebrow">{tr(language, "secureCheckout")}</p>
      <h2>{text.voucherQuestion}</h2>
      {!voucherDecided ? <div className="voucherChoice">
        <button onClick={() => { setShowVoucher(true); setVoucherDecided(true); }}>{tr(language, "haveVoucher")}</button>
        <button onClick={() => { setShowVoucher(false); setVoucherDecided(true); }}>{text.noVoucher}</button>
      </div> : showVoucher ? <div className="voucherEntry">
        <input value={voucherCode} onChange={event => setVoucherCode(event.target.value.toUpperCase())} placeholder="DR10001 / FD50002" />
        <button disabled={applying} onClick={apply}>{applying ? "..." : text.apply}</button>
      </div> : <button className="addVoucherLink" onClick={() => setShowVoucher(true)}>+ {tr(language, "addVoucher")}</button>}
      {error && <p className="checkoutError">{error}</p>}
      <BillBreakdown bill={bill} language={language} amountLabel={text.amountDue} />
      <button className="primaryButton full" disabled={loading} onClick={onPay}>
        {loading ? tr(language, "preparingSecurePayment") : text.pay}<Icon name="chevron" />
      </button>
    </section>
  </div>;
}

function BillBreakdown({ bill, language, amountLabel }: { bill: BillSnapshot; language: Language; amountLabel: string }) {
  return <div className="billBreakdown">
    <div><span>{tr(language, "subtotal")}</span><b>{money(bill.subtotal, language)}</b></div>
    {bill.voucherDiscountAmount > 0 && <div className="discountLine"><span>{tr(language, "voucher")} {bill.voucherCode}</span><b>− {money(bill.voucherDiscountAmount, language)}</b></div>}
    {bill.billDiscountAmount > 0 && <div className="discountLine"><span>{tr(language, "serviceRecovery")} ({bill.billDiscountPercent}%)<small>{bill.billDiscountReason}</small></span><b>− {money(bill.billDiscountAmount, language)}</b></div>}
    {bill.foodVatAmount > 0 && <div><span>{tr(language, "foodVat")}</span><b>{money(bill.foodVatAmount, language)}</b></div>}
    {bill.alcoholVatAmount > 0 && <div><span>{tr(language, "alcoholVat")}</span><b>{money(bill.alcoholVatAmount, language)}</b></div>}
    {bill.serviceChargeAmount > 0 && <div><span>{bill.serviceChargeName || tr(language, "serviceCharge")}</span><b>{money(bill.serviceChargeAmount, language)}</b></div>}
    <div className="billGrandTotal"><span>{amountLabel}</span><b>{money(bill.totalAmount, language)}</b></div>
  </div>;
}

function PaymentModal({ payment, language, onClose }: { payment: SePayPayment; language: Language; onClose: () => void }) {
  const paid = payment.status === "Paid";
  const terminal = payment.status === "Failed" || payment.status === "Expired";
  return <div className="overlay paymentOverlay"><section className="paymentCard">
    <button className="closeButton" onClick={onClose}><Icon name="close" /></button>
    <p className="eyebrow">{paid ? tr(language, "paymentConfirmed") : terminal ? tr(language, "paymentIncomplete") : tr(language, "secureTransfer")}</p>
    <h2>{paid ? tr(language, "thankYou") : terminal ? tr(language, "tryAgain") : tr(language, "scanToPay")}</h2>
    {paid ? <div className="paymentSuccess"><Icon name="check" size={38} /><b>{money(payment.amount, language)}</b><span>{tr(language, "receipt")} #{payment.receiptId}</span></div> :
      terminal ? <div className="paymentFailure"><Icon name="close" size={32} /><p>{payment.failureReason || tr(language, "paymentInactive")}</p></div> :
        <>
          {/* The provider generates this QR dynamically; Next image optimization would cache payment-specific URLs. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img className="paymentQr" src={payment.qrUrl} alt={`Payment QR for ${payment.reference}`} />
          <div className="paymentAmount"><span>{copy[language].amountDue}</span><b>{money(payment.amount, language)}</b></div>
          <dl className="paymentDetails"><div><dt>{tr(language, "account")}</dt><dd>{payment.accountNumber}</dd></div><div><dt>{tr(language, "accountName")}</dt><dd>{payment.accountName}</dd></div><div><dt>{tr(language, "transferContent")}</dt><dd>{payment.reference}</dd></div></dl>
          <p className="paymentHint">{tr(language, "transferHint")}</p>
          <div className="paymentWaiting"><i /> {tr(language, "waitingPayment")}</div>
        </>}
  </section></div>;
}

function ItemModal({ product, language, onClose, onAdd }: { product: Product; language: Language; onClose: () => void; onAdd: (p: Product, q: number, note: string) => void }) {
  const [quantity, setQuantity] = useState(1);
  const [note, setNote] = useState("");
  return <div className="overlay" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
    <div className="itemModal">
      <button className="closeButton" onClick={onClose}><Icon name="close" /></button>
      <div className="modalImage" style={product.imageUrl ? { backgroundImage: `url("${product.imageUrl}")` } : undefined}><span>✦</span></div>
      <div className="modalBody"><p className="eyebrow">{categoryName(language, product.category?.name)}</p><h2>{productName(product)}</h2><p>{product.description}</p>
        {product.remainingQty != null && <div className="remaining"><b>{product.remainingQty}</b><span>{tr(language, "portionsLeft")}</span></div>}
        <label>{tr(language, "specialRequest")}<textarea value={note} onChange={(e) => setNote(e.target.value)} placeholder={tr(language, "notePlaceholder")} /></label>
        <div className="modalAction"><div className="stepper large"><button onClick={() => setQuantity(Math.max(1, quantity - 1))}><Icon name="minus" /></button><b>{quantity}</b><button onClick={() => setQuantity(Math.min(product.remainingQty ?? 99, quantity + 1))}><Icon name="plus" /></button></div>
          <button className="primaryButton" onClick={() => onAdd(product, quantity, note)}>{tr(language, "add")} · {money(product.price * quantity, language)}</button></div>
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

function Preferences({ language, selected, required, onClose, onSave }: { language: Language; selected: string[]; required?: boolean; onClose: () => void; onSave: (items: string[]) => void | Promise<void> }) {
  const choices = ["Dairy", "Gluten", "Peanuts", "Tree nuts", "Shellfish", "Fish", "Eggs", "Soy", "Sesame", "Mustard", "Celery", "Sulphites"];
  const [items, setItems] = useState(selected);
  return <div className="overlay"><div className="preferences">
    {!required && <button className="closeButton" onClick={onClose}><Icon name="close" /></button>}<span className="preferenceIcon"><Icon name="leaf" size={32} /></span>
    <p className="eyebrow">{copy[language].dietary}</p><h2>{uiCopy[language].allergiesTitle}</h2><p>{uiCopy[language].allergiesText}</p>
    <div className="choiceGrid">{choices.map((choice) => <button key={choice} className={items.includes(choice) ? "active" : ""} onClick={() => setItems((list) => list.includes(choice) ? list.filter((x) => x !== choice) : [...list, choice])}>{items.includes(choice) && <Icon name="check" size={16} />}{extraCopy[language][choice as keyof typeof extraCopy.en]}</button>)}</div>
    <button className="primaryButton full" onClick={() => onSave(items)}>{uiCopy[language].save}</button><button className="textButton" onClick={() => onSave([])}>{uiCopy[language].none}</button>
  </div></div>;
}

function QrScanner({ error, onScan, onRetry }: { error: string; onScan: (value: string) => void; onRetry: () => void }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [cameraError, setCameraError] = useState("");
  const [manualCode, setManualCode] = useState("");
  const [scanLanguage, setScanLanguage] = useState<Language>("en");

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
        setCameraError(tr(scanLanguage, "cameraRequired"));
      }
    };
    start();
    return () => {
      stopped = true;
      window.clearTimeout(timer);
      stream?.getTracks().forEach(track => track.stop());
    };
  }, [onScan, scanLanguage]);

  return <main className="scannerPage">
    <div className="scannerTheme"><ThemeSwitcher /></div>
    <section className="scannerCard">
      <select className="scannerLanguage" value={scanLanguage} onChange={event => setScanLanguage(event.target.value as Language)} aria-label={tr(scanLanguage, "chooseLanguage")}>
        {languages.map(item => <option value={item.code} key={item.code}>{item.label}</option>)}
      </select>
      <div className="scannerBrand">ML</div>
      <p className="eyebrow">MAISON LUCAS · {tr(scanLanguage, "tableOrdering")}</p>
      <h1>{tr(scanLanguage, "scanTitle")}</h1>
      <p>{tr(scanLanguage, "scanText")}</p>
      <div className="cameraFrame">
        <video ref={videoRef} muted playsInline />
        <div className="scanCorners" />
        <span>{tr(scanLanguage, "placeQr")}</span>
      </div>
      {(error || cameraError) && <div className="scanError"><b>{error || cameraError}</b>{error && <button onClick={onRetry}>{tr(scanLanguage, "scanAgain")}</button>}</div>}
      <details>
        <summary>{tr(scanLanguage, "manualEntry")}</summary>
        <div className="manualQr"><input value={manualCode} onChange={event => setManualCode(event.target.value)} placeholder={tr(scanLanguage, "tableCode")} /><button onClick={() => manualCode.trim() && onScan(manualCode.trim())}>{tr(scanLanguage, "joinTable")}</button></div>
      </details>
    </section>
  </main>;
}
