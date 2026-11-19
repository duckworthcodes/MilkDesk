import { useEffect, useMemo, useState } from "react";
import type { FormEvent } from "react";
import {
  Activity,
  ArrowRight,
  ArrowUpRight,
  CalendarDays,
  Check,
  CircleAlert,
  Droplets,
  Ellipsis,
  FileText,
  LayoutGrid,
  Leaf,
  Menu,
  Milk,
  Plus,
  RefreshCw,
  Search,
  Settings2,
  Trash2,
  ShoppingBag,
  Sparkles,
  Users,
  Wallet,
  X,
} from "lucide-react";
import "./App.css";
const API_URL = import.meta.env.VITE_API_URL || "http://localhost:4000";

type Customer = {
  id: string;
  name: string;
  phone: string | null;
  address: string | null;
  defaultRatePaise: number;
  isActive: boolean;
  deactivatedAt?: string | null;
  deactivationReason?: string | null;
};

type Delivery = {
  id: string;
  customerId: string;
  quantityMl: number;
  ratePerLitrePaise: number;
  amountPaise: number;
  deliveredAt: string;
  notes: string | null;
  customer: {
    name: string;
    phone: string | null;
  };
};

type Page = "overview" | "customers" | "deliveries";

const money = (paise: number) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 2,
  }).format(paise / 100);

const litres = (ml: number) => `${(ml / 1000).toFixed(2)} L`;

const getLocalDate = () => {
  const date = new Date();
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const formatDate = (date: string) =>
  new Date(date).toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });

const formatTime = (date: string) =>
  new Date(date).toLocaleTimeString("en-IN", {
    hour: "2-digit",
    minute: "2-digit",
  });

function App() {
  const [page, setPage] = useState<Page>("overview");
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [deliveries, setDeliveries] = useState<Delivery[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [customerModal, setCustomerModal] = useState(false);
  const [deliveryModal, setDeliveryModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");
  const [mobileNav, setMobileNav] = useState(false);
  const [customerStatus, setCustomerStatus] = useState<"all" | "active" | "inactive">("active");
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);
  const [deactivationCustomer, setDeactivationCustomer] = useState<Customer | null>(null);
  const [deactivationReason, setDeactivationReason] = useState("");

  const [customerForm, setCustomerForm] = useState({
    name: "",
    phone: "",
    address: "",
    rate: "50",
  });

  const [deliveryForm, setDeliveryForm] = useState({
    customerId: "",
    quantity: "1",
    notes: "",
    date: getLocalDate(),
  });

  async function loadData() {
    try {
      setLoading(true);
      setError("");

      const [customerResponse, deliveryResponse] = await Promise.all([
        fetch(`${API_URL}/api/customers?status=all`),
        fetch(`${API_URL}/api/deliveries`),
      ]);

      if (!customerResponse.ok || !deliveryResponse.ok) {
        throw new Error("Unable to load MilkDesk data.");
      }

      const [customerData, deliveryData] = await Promise.all([
        customerResponse.json(),
        deliveryResponse.json(),
      ]);

      setCustomers(customerData);
      setDeliveries(deliveryData);
    } catch {
      setError("Couldn't connect to MilkDesk. Check that your API server is running.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, []);

  const todayKey = new Date().toLocaleDateString("en-CA");

  const todayDeliveries = useMemo(
    () =>
      deliveries.filter(
        (delivery) =>
          new Date(delivery.deliveredAt).toLocaleDateString("en-CA") ===
          todayKey
      ),
    [deliveries, todayKey]
  );

  const todayVolume = todayDeliveries.reduce(
    (sum, delivery) => sum + delivery.quantityMl,
    0
  );

  const todayRevenue = todayDeliveries.reduce(
    (sum, delivery) => sum + delivery.amountPaise,
    0
  );

  const recentDeliveries = [...deliveries]
    .sort((a, b) => new Date(b.deliveredAt).getTime() - new Date(a.deliveredAt).getTime())
    .slice(0, 5);

  const activeCustomers = customers.filter((customer) => customer.isActive);
  const averageRate = activeCustomers.length
    ? activeCustomers.reduce(
        (sum, customer) => sum + customer.defaultRatePaise,
        0
      ) / activeCustomers.length
    : 0;

  const filteredCustomers = customers.filter((customer) => {
    const matchesStatus =
      customerStatus === "all" ||
      (customerStatus === "active" ? customer.isActive : !customer.isActive);
    const matchesSearch = `${customer.name} ${customer.phone ?? ""} ${customer.address ?? ""}`
      .toLowerCase()
      .includes(search.toLowerCase());
    return matchesStatus && matchesSearch;
  });

  const filteredDeliveries = deliveries.filter((delivery) =>
    `${delivery.customer.name} ${delivery.customer.phone ?? ""}`
      .toLowerCase()
      .includes(search.toLowerCase())
  );

  const selectedCustomer = activeCustomers.find(
    (customer) => customer.id === deliveryForm.customerId
  );

  const estimatedAmount = selectedCustomer
    ? Math.round(
        (Number(deliveryForm.quantity) * 1000 *
          selectedCustomer.defaultRatePaise) /
          1000
      )
    : 0;

  async function saveCustomer(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const rate = Number(customerForm.rate);

    if (!Number.isFinite(rate) || rate <= 0) {
      setFormError("Enter a valid milk rate.");
      return;
    }

    try {
      setSaving(true);
      setFormError("");

      const isEditing = Boolean(editingCustomer);
      const response = await fetch(
        isEditing
          ? `${API_URL}/api/customers/${editingCustomer!.id}`
          : `${API_URL}/api/customers`,
        {
          method: isEditing ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: customerForm.name.trim(),
            phone: customerForm.phone.trim() || null,
            address: customerForm.address.trim() || null,
            defaultRatePaise: Math.round(rate * 100),
          }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Unable to save customer.");
      }

      setCustomers((previous) =>
        isEditing
          ? previous
              .map((customer) => customer.id === data.id ? data : customer)
              .sort((a, b) => a.name.localeCompare(b.name))
          : [...previous, data].sort((a, b) => a.name.localeCompare(b.name))
      );

      setCustomerForm({ name: "", phone: "", address: "", rate: "50" });
      setEditingCustomer(null);
      setCustomerModal(false);
    } catch (err) {
      setFormError(
        err instanceof Error ? err.message : "Something went wrong."
      );
    } finally {
      setSaving(false);
    }
  }

  async function deleteCustomer(customer: Customer) {
    const confirmed = window.confirm(
      `Permanently delete ${customer.name}? This is only possible when the customer has no delivery, invoice, or payment history.`
    );
    if (!confirmed) return;

    try {
      const response = await fetch(`${API_URL}/api/customers/${customer.id}`, {
        method: "DELETE",
      });
      const data = await response.json();

      if (!response.ok) {
        if (response.status === 409) {
          throw new Error(
            data.error || "This customer has transaction history. Deactivate the customer instead."
          );
        }
        throw new Error(data.error || "Unable to delete customer.");
      }

      setCustomers((previous) => previous.filter((item) => item.id !== customer.id));
      window.alert("Customer permanently deleted.");
    } catch (err) {
      window.alert(err instanceof Error ? err.message : "Unable to delete customer.");
    }
  }

  async function deactivateCustomer() {
    if (!deactivationCustomer) return;
    if (!deactivationReason.trim()) {
      setFormError("Please enter a reason for deactivation.");
      return;
    }

    try {
      setSaving(true);
      setFormError("");
      const response = await fetch(
        `${API_URL}/api/customers/${deactivationCustomer.id}/deactivate`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ reason: deactivationReason.trim() }),
        }
      );
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Unable to deactivate customer.");
      }

      setCustomers((previous) =>
        previous.map((customer) =>
          customer.id === deactivationCustomer.id
            ? { ...customer, ...data.customer, isActive: false }
            : customer
        )
      );
      setDeactivationCustomer(null);
      setDeactivationReason("");
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setSaving(false);
    }
  }

  async function reactivateCustomer(customer: Customer) {
    if (!window.confirm(`Reactivate ${customer.name}? They will be available for new deliveries again.`)) {
      return;
    }

    try {
      const response = await fetch(
        `${API_URL}/api/customers/${customer.id}/reactivate`,
        { method: "PATCH" }
      );
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Unable to reactivate customer.");
      }

      setCustomers((previous) =>
        previous.map((item) =>
          item.id === customer.id ? { ...item, ...data.customer, isActive: true } : item
        )
      );
    } catch (err) {
      window.alert(err instanceof Error ? err.message : "Unable to reactivate customer.");
    }
  }

  async function createDelivery(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const quantity = Number(deliveryForm.quantity);

    if (!deliveryForm.customerId) {
      setFormError("Choose a customer first.");
      return;
    }

    if (!Number.isFinite(quantity) || quantity <= 0) {
      setFormError("Enter a valid milk quantity.");
      return;
    }

    try {
      setSaving(true);
      setFormError("");

      const response = await fetch(`${API_URL}/api/deliveries`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customerId: deliveryForm.customerId,
          quantityMl: Math.round(quantity * 1000),
          notes: deliveryForm.notes.trim() || null,
          deliveredAt: new Date(
            `${deliveryForm.date}T${new Date().toTimeString().slice(0, 8)}`
          ).toISOString(),
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Unable to save delivery.");
      }

      setDeliveries((previous) => [data, ...previous]);
      setDeliveryForm({
        customerId: "",
        quantity: "1",
        notes: "",
        date: getLocalDate(),
      });
      setDeliveryModal(false);
    } catch (err) {
      setFormError(
        err instanceof Error ? err.message : "Something went wrong."
      );
    } finally {
      setSaving(false);
    }
  }

  function openCustomerModal(customer?: Customer) {
    setFormError("");
    setEditingCustomer(customer ?? null);
    setCustomerForm(
      customer
        ? {
            name: customer.name,
            phone: customer.phone ?? "",
            address: customer.address ?? "",
            rate: (customer.defaultRatePaise / 100).toFixed(2),
          }
        : { name: "", phone: "", address: "", rate: "50" }
    );
    setCustomerModal(true);
  }

  function openDeliveryModal() {
    setFormError("");
    setDeliveryForm({
      customerId: customers.find((customer) => customer.isActive)?.id ?? "",
      quantity: "1",
      notes: "",
      date: getLocalDate(),
    });
    setDeliveryModal(true);
  }

  function closeModals() {
    if (saving) return;
    setCustomerModal(false);
    setDeliveryModal(false);
    setEditingCustomer(null);
    setFormError("");
  }

  function closeDeactivation() {
    if (saving) return;
    setDeactivationCustomer(null);
    setDeactivationReason("");
    setFormError("");
  }

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      if (deactivationCustomer) closeDeactivation();
      else if (customerModal || deliveryModal) closeModals();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [customerModal, deliveryModal, deactivationCustomer, saving]);

  const currentTitle = {
    overview: "The daily edit.",
    customers: "Your people.",
    deliveries: "Milk, delivered.",
  }[page];

  const currentSubtitle = {
    overview: "A little overview of everything happening at the counter.",
    customers: "The people who make your milk business run.",
    deliveries: "Every litre, every customer, every transaction.",
  }[page];

  return (
    <div className="app-shell">
      <aside className={`sidebar ${mobileNav ? "sidebar-open" : ""}`}>
        <div className="brand-lockup">
          <div className="brand-mark">
            <Milk size={23} strokeWidth={1.8} />
          </div>
          <div className="brand-name">
            <span>milkdesk</span>
            <small>THE DAILY DAIRY JOURNAL</small>
          </div>
          <button
            className="mobile-close icon-button"
            onClick={() => setMobileNav(false)}
            aria-label="Close navigation"
          >
            <X size={18} />
          </button>
        </div>

        <div className="sidebar-section-label">YOUR WORKSPACE</div>

        <nav className="sidebar-nav">
          <button
            className={`nav-link ${page === "overview" ? "active" : ""}`}
            onClick={() => {
              setPage("overview");
              setMobileNav(false);
            }}
          >
            <LayoutGrid size={19} />
            <span>Overview</span>
            {page === "overview" && <span className="nav-indicator" />}
          </button>

          <button
            className={`nav-link ${page === "customers" ? "active" : ""}`}
            onClick={() => {
              setPage("customers");
              setSearch("");
              setMobileNav(false);
            }}
          >
            <Users size={19} />
            <span>Customers</span>
            <span className="nav-count">{activeCustomers.length}</span>
          </button>

          <button
            className={`nav-link ${page === "deliveries" ? "active" : ""}`}
            onClick={() => {
              setPage("deliveries");
              setSearch("");
              setMobileNav(false);
            }}
          >
            <Droplets size={19} />
            <span>Deliveries</span>
          </button>
        </nav>

        <div className="sidebar-section-label secondary-label">COMING SOON</div>

        <nav className="sidebar-nav muted-nav">
          <button className="nav-link" disabled>
            <FileText size={19} />
            <span>Monthly bills</span>
            <span className="soon-tag">SOON</span>
          </button>
          <button className="nav-link" disabled>
            <Wallet size={19} />
            <span>Payments</span>
          </button>
        </nav>

        <div className="sidebar-bottom">
          <div className="sidebar-note">
            <div className="note-icon"><Leaf size={17} /></div>
            <p>Fresh milk.<br /><strong>Clear records.</strong></p>
            <span>01 / 03</span>
          </div>

          <div className="account-row">
            <div className="account-avatar">KV</div>
            <div className="account-copy">
              <strong>Milk Counter</strong>
              <span>Administrator</span>
            </div>
            <Ellipsis size={19} />
          </div>
        </div>
      </aside>

      <main className="main-area">
        <header className="topbar">
          <button
            className="mobile-menu icon-button"
            onClick={() => setMobileNav(true)}
            aria-label="Open navigation"
          >
            <Menu size={21} />
          </button>

          <div className="topbar-context">
            <span className="context-dot" />
            <span>COUNTER /</span>
            <strong>{page.toUpperCase()}</strong>
          </div>

          <div className="topbar-right">
            <div className="live-status">
              <span />
              LOCAL SYSTEM
            </div>
            <div className="topbar-divider" />
            <div className="topbar-date">
              <CalendarDays size={15} />
              {new Date().toLocaleDateString("en-IN", {
                weekday: "short",
                day: "numeric",
                month: "short",
              })}
            </div>
            <button
              className="icon-button refresh-button"
              onClick={loadData}
              aria-label="Refresh data"
              title="Refresh data"
            >
              <RefreshCw size={17} />
            </button>
          </div>
        </header>

        <div className="page-content">
          <section className="page-heading">
            <div className="heading-copy">
              <div className="eyebrow">
                <span className="eyebrow-line" />
                THE MILK BUSINESS, MADE SIMPLE
              </div>
              <h1>{currentTitle}</h1>
              <p>{currentSubtitle}</p>
            </div>

            <div className="heading-actions">
              {page === "customers" ? (
                <button className="button-dark" onClick={() => openCustomerModal()}>
                  <Plus size={17} /> Add customer
                </button>
              ) : (
                <button className="button-dark" onClick={openDeliveryModal}>
                  <Plus size={17} /> New delivery
                </button>
              )}
            </div>
          </section>

          {error && (
            <div className="system-error">
              <CircleAlert size={18} />
              <span>{error}</span>
              <button onClick={loadData}>Try again</button>
            </div>
          )}

          {page === "overview" && (
            <>
              <section className="hero-grid">
                <div className="hero-panel">
                  <div className="hero-topline">
                    <span><Sparkles size={15} /> THURSDAY'S SNAPSHOT</span>
                    <span className="hero-index">01 — TODAY</span>
                  </div>

                  <div className="hero-main">
                    <div>
                      <p className="hero-label">MILK OUT THE DOOR</p>
                      <div className="hero-number">
                        {loading ? "—" : litres(todayVolume).replace(" L", "")}
                        <span>L</span>
                      </div>
                      <p className="hero-description">
                        Total volume delivered today.
                      </p>
                    </div>
                    <div className="hero-art">
                      <div className="art-circle art-circle-one" />
                      <div className="art-circle art-circle-two" />
                      <Milk size={75} strokeWidth={1.1} />
                      <span>FRESH<br />EVERY<br />MORNING</span>
                    </div>
                  </div>

                  <div className="hero-footer">
                    <span><Activity size={15} /> DAILY OPERATIONS</span>
                    <span>{todayDeliveries.length} RECORDS <ArrowUpRight size={14} /></span>
                  </div>
                </div>

                <div className="revenue-panel">
                  <div className="panel-kicker">
                    <span>01 / COLLECTION</span>
                    <Wallet size={18} />
                  </div>
                  <p>Today's delivery value</p>
                  <h2>{loading ? "—" : money(todayRevenue)}</h2>
                  <div className="revenue-foot">
                    <span className="lime-dot" />
                    Calculated from today's deliveries
                  </div>
                  <div className="revenue-decoration">₹</div>
                </div>
              </section>

              <section className="metric-strip">
                <div className="metric-item">
                  <div className="metric-top">
                    <span>REGISTERED CUSTOMERS</span>
                    <Users size={17} />
                  </div>
                  <div className="metric-value">{loading ? "—" : activeCustomers.length}</div>
                  <div className="metric-foot">Active customer records</div>
                </div>

                <div className="metric-item">
                  <div className="metric-top">
                    <span>AVG. MILK RATE</span>
                    <ShoppingBag size={17} />
                  </div>
                  <div className="metric-value">
                    {loading ? "—" : money(averageRate)}<small>/L</small>
                  </div>
                  <div className="metric-foot">Across registered customers</div>
                </div>

                <div className="metric-item">
                  <div className="metric-top">
                    <span>DELIVERIES TODAY</span>
                    <Droplets size={17} />
                  </div>
                  <div className="metric-value">{loading ? "—" : todayDeliveries.length}</div>
                  <div className="metric-foot">Recorded delivery entries</div>
                </div>
              </section>

              <section className="overview-bottom">
                <div className="section-heading">
                  <div>
                    <span className="section-index">02 / THE LEDGER</span>
                    <h2>Recent deliveries<span>.</span></h2>
                  </div>
                  <button
                    className="text-link"
                    onClick={() => setPage("deliveries")}
                  >
                    View all <ArrowRight size={16} />
                  </button>
                </div>

                <div className="ledger-card">
                  {loading ? (
                    <div className="empty-state">Loading your ledger...</div>
                  ) : deliveries.length === 0 ? (
                    <div className="empty-state">
                      <div className="empty-illustration"><Droplets size={27} /></div>
                      <h3>A clean slate.</h3>
                      <p>Your first delivery record will show up here.</p>
                      <button className="button-dark" onClick={openDeliveryModal}>
                        <Plus size={16} /> Record a delivery
                      </button>
                    </div>
                  ) : (
                    <div className="ledger-list">
                      {recentDeliveries.map((delivery, index) => (
                        <div className="ledger-row" key={delivery.id}>
                          <div className="ledger-number">
                            {String(index + 1).padStart(2, "0")}
                          </div>
                          <div className="customer-initial">
                            {delivery.customer.name.charAt(0).toUpperCase()}
                          </div>
                          <div className="ledger-customer">
                            <strong>{delivery.customer.name}</strong>
                            <span>{delivery.customer.phone || "No phone number"}</span>
                          </div>
                          <div className="ledger-quantity">
                            <strong>{litres(delivery.quantityMl)}</strong>
                            <span>{money(delivery.ratePerLitrePaise)}/L</span>
                          </div>
                          <div className="ledger-time">
                            <strong>{formatTime(delivery.deliveredAt)}</strong>
                            <span>{formatDate(delivery.deliveredAt)}</span>
                          </div>
                          <div className="ledger-amount">{money(delivery.amountPaise)}</div>
                          <div className="ledger-arrow"><ArrowUpRight size={17} /></div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </section>

              <section className="bottom-note">
                <div className="bottom-note-icon"><Leaf size={19} /></div>
                <div>
                  <strong>Small business. Thoughtfully managed.</strong>
                  <p>MilkDesk keeps your daily records organised, one delivery at a time.</p>
                </div>
                <span>MADE FOR THE MORNING SHIFT</span>
              </section>
            </>
          )}

          {page === "customers" && (
            <section className="directory-section">
              <div className="section-heading">
                <div>
                  <span className="section-index">01 / YOUR COMMUNITY</span>
                  <h2>The customer book<span>.</span></h2>
                </div>
                <span className="directory-total">
                  {customers.length.toString().padStart(2, "0")} REGISTERED
                </span>
              </div>

              <div className="directory-toolbar">
                <div className="search-field">
                  <Search size={18} />
                  <input
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                    placeholder="Find someone..."
                  />
                  <kbd>⌘ K</kbd>
                </div>
                <div className="customer-toolbar-actions">
                  <div className="status-filter" role="group" aria-label="Filter customers">
                    {(["all", "active", "inactive"] as const).map((status) => (
                      <button
                        key={status}
                        type="button"
                        className={customerStatus === status ? "selected" : ""}
                        onClick={() => setCustomerStatus(status)}
                      >
                        {status.charAt(0).toUpperCase() + status.slice(1)}
                      </button>
                    ))}
                  </div>
                  <button className="filter-button" onClick={loadData}>
                    <RefreshCw size={16} /> Refresh
                  </button>
                </div>
              </div>

              <div className="customer-grid">
                {loading ? (
                  <div className="empty-state">Loading customers...</div>
                ) : filteredCustomers.length === 0 ? (
                  <div className="empty-state">
                    <div className="empty-illustration"><Users size={27} /></div>
                    <h3>{search ? "No matches found." : "No customers in this view."}</h3>
                    <p>
                      {search
                        ? "Try a different name or phone number."
                        : customerStatus === "active"
                          ? "There are no active customers in this list."
                          : customerStatus === "inactive"
                            ? "No inactive customers yet."
                            : "Add your first customer to get started."}
                    </p>
                    {!search && customerStatus !== "inactive" && (
                      <button className="button-dark" onClick={() => openCustomerModal()}>
                        <Plus size={16} /> Add customer
                      </button>
                    )}
                  </div>
                ) : (
                  filteredCustomers.map((customer, index) => (
                    <article className="customer-card" key={customer.id}>
                      <div className="customer-card-top">
                        <span className="customer-card-number">
                          NO. {String(index + 1).padStart(2, "0")}
                        </span>
                        <span className={`active-pill ${customer.isActive ? "" : "inactive"}`}>
                          <span /> {customer.isActive ? "ACTIVE" : "INACTIVE"}
                        </span>
                      </div>
                      <div className="customer-avatar">
                        {customer.name.charAt(0).toUpperCase()}
                      </div>
                      <h3>{customer.name}</h3>
                      <p>{customer.phone || "Phone not added"}</p>
                      <div className="customer-card-divider" />
                      <div className="customer-card-details">
                        <div>
                          <span>DEFAULT RATE</span>
                          <strong>{money(customer.defaultRatePaise)}<small>/L</small></strong>
                        </div>
                        <div>
                          <span>LOCATION</span>
                          <strong className="address-value">{customer.address || "Not added"}</strong>
                        </div>
                      </div>
                      {!customer.isActive && customer.deactivationReason && (
                        <p className="deactivation-note">Reason: {customer.deactivationReason}</p>
                      )}
                      <div className="customer-card-actions">
                        <button type="button" className="card-action edit" onClick={() => openCustomerModal(customer)}>
                          <Settings2 size={14} /> Edit
                        </button>
                        {customer.isActive ? (
                          <button
                            type="button"
                            className="card-action deactivate"
                            onClick={() => {
                              setFormError("");
                              setDeactivationReason("");
                              setDeactivationCustomer(customer);
                            }}
                          >
                            Deactivate
                          </button>
                        ) : (
                          <button type="button" className="card-action reactivate" onClick={() => reactivateCustomer(customer)}>
                            Reactivate
                          </button>
                        )}
                        <button type="button" className="card-action delete" onClick={() => deleteCustomer(customer)}>
                          <Trash2 size={14} /> Delete
                        </button>
                      </div>
                    </article>
                  ))
                )}
              </div>
            </section>
          )}

          {page === "deliveries" && (
            <section className="directory-section">
              <div className="section-heading">
                <div>
                  <span className="section-index">01 / DAILY RECORDS</span>
                  <h2>The milk ledger<span>.</span></h2>
                </div>
                <span className="directory-total">
                  {deliveries.length.toString().padStart(2, "0")} ENTRIES
                </span>
              </div>

              <div className="directory-toolbar">
                <div className="search-field">
                  <Search size={18} />
                  <input
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                    placeholder="Search by customer..."
                  />
                </div>
                <button className="filter-button" onClick={loadData}>
                  <RefreshCw size={16} /> Refresh
                </button>
              </div>

              <div className="delivery-table-card">
                {loading ? (
                  <div className="empty-state">Loading delivery records...</div>
                ) : filteredDeliveries.length === 0 ? (
                  <div className="empty-state">
                    <div className="empty-illustration"><Droplets size={27} /></div>
                    <h3>No deliveries yet.</h3>
                    <p>Your delivery history will build up here.</p>
                    <button className="button-dark" onClick={openDeliveryModal}>
                      <Plus size={16} /> Record delivery
                    </button>
                  </div>
                ) : (
                  <div className="table-scroll">
                    <table className="editorial-table">
                      <thead>
                        <tr>
                          <th>DATE & TIME</th>
                          <th>CUSTOMER</th>
                          <th>QUANTITY</th>
                          <th>RATE / LITRE</th>
                          <th>AMOUNT</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredDeliveries.map((delivery) => (
                          <tr key={delivery.id}>
                            <td>
                              <strong>{formatDate(delivery.deliveredAt)}</strong>
                              <span className="table-subtext">{formatTime(delivery.deliveredAt)}</span>
                            </td>
                            <td>
                              <strong>{delivery.customer.name}</strong>
                              <span className="table-subtext">{delivery.customer.phone || "—"}</span>
                            </td>
                            <td><strong>{litres(delivery.quantityMl)}</strong></td>
                            <td>{money(delivery.ratePerLitrePaise)}</td>
                            <td className="amount-cell">{money(delivery.amountPaise)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
              <p className="ledger-footnote">
                <Check size={14} /> Each delivery retains the rate applied when it was recorded.
              </p>
            </section>
          )}

          <footer className="page-footer">
            <span>© {new Date().getFullYear()} MILKDESK</span>
            <span>MADE WITH CARE, FOR EVERY MORNING.</span>
            <span className="database-status">
              <span className={`footer-status-dot ${error ? "footer-status-error" : ""}`} />
              {error ? "DATABASE UNREACHABLE" : "LOCAL DATABASE CONNECTED"}
            </span>
          </footer>
        </div>
      </main>

      {(customerModal || deliveryModal) && (
        <div
          className="modal-backdrop"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) closeModals();
          }}
        >
          <section className="editorial-modal" role="dialog" aria-modal="true">
            <div className="modal-topline">
              <span>{customerModal ? "THE CUSTOMER BOOK" : "THE DAILY LEDGER"}</span>
              <button
                className="icon-button"
                onClick={closeModals}
                disabled={saving}
                aria-label="Close modal"
              >
                <X size={19} />
              </button>
            </div>

            <div className="modal-title">
              <span className="section-index">
                {customerModal ? (editingCustomer ? "EDIT CUSTOMER / 01" : "NEW REGISTRATION / 01") : "NEW RECORD / 01"}
              </span>
              <h2>{customerModal ? (editingCustomer ? "A familiar face." : "A new face.") : "Log the milk."}</h2>
              <p>
                {customerModal
                  ? editingCustomer ? "Update their contact details or default rate. Past deliveries keep their original rate." : "Add someone to your daily milk route."
                  : "Record a delivery and keep your ledger up to date."}
              </p>
            </div>

            {customerModal && (
              <form className="editorial-form" onSubmit={saveCustomer}>
                <label>
                  CUSTOMER NAME <span>*</span>
                  <input
                    autoFocus
                    required
                    placeholder="e.g. Rahul Sharma"
                    value={customerForm.name}
                    onChange={(event) =>
                      setCustomerForm({ ...customerForm, name: event.target.value })
                    }
                  />
                </label>
                <label>
                  PHONE NUMBER
                  <input
                    placeholder="Mobile number"
                    value={customerForm.phone}
                    onChange={(event) =>
                      setCustomerForm({ ...customerForm, phone: event.target.value })
                    }
                  />
                </label>
                <label>
                  ADDRESS
                  <input
                    placeholder="Area, street or house number"
                    value={customerForm.address}
                    onChange={(event) =>
                      setCustomerForm({ ...customerForm, address: event.target.value })
                    }
                  />
                </label>
                <label>
                  CUSTOMER'S MILK RATE <span>*</span>
                  <div className="input-with-unit">
                    <span>₹</span>
                    <input
                      required
                      type="number"
                      min="0.01"
                      step="0.01"
                      value={customerForm.rate}
                      onChange={(event) =>
                        setCustomerForm({ ...customerForm, rate: event.target.value })
                      }
                    />
                    <small>PER LITRE</small>
                  </div>
                </label>

                {formError && <p className="form-error">{formError}</p>}

                <div className="form-actions">
                  <button
                    type="button"
                    className="button-light"
                    onClick={closeModals}
                    disabled={saving}
                  >
                    Cancel
                  </button>
                  <button type="submit" className="button-dark" disabled={saving}>
                    {saving ? "Saving..." : editingCustomer ? "Save changes" : "Save customer"} <ArrowRight size={16} />
                  </button>
                </div>
              </form>
            )}

            {deliveryModal && (
              <form className="editorial-form" onSubmit={createDelivery}>
                <label>
                  DELIVERY DATE <span>*</span>
                  <input
                    type="date"
                    required
                    max={getLocalDate()}
                    value={deliveryForm.date}
                    onChange={(event) =>
                      setDeliveryForm({
                        ...deliveryForm,
                        date: event.target.value,
                      })
                    }
                  />
                </label>

                <label>
                  SELECT CUSTOMER <span>*</span>
                  <select
                    autoFocus
                    required
                    value={deliveryForm.customerId}
                    onChange={(event) =>
                      setDeliveryForm({ ...deliveryForm, customerId: event.target.value })
                    }
                  >
                    <option value="">Choose a customer</option>
                    {customers.filter((customer) => customer.isActive).map((customer) => (
                      <option key={customer.id} value={customer.id}>
                        {customer.name}
                      </option>
                    ))}
                  </select>
                </label>

                {selectedCustomer && (
                  <div className="selected-rate">
                    <span>THEIR DEFAULT RATE</span>
                    <strong>{money(selectedCustomer.defaultRatePaise)} / L</strong>
                  </div>
                )}

                <label>
                  MILK QUANTITY <span>*</span>
                  <div className="input-with-unit">
                    <input
                      required
                      type="number"
                      min="0.01"
                      step="0.01"
                      value={deliveryForm.quantity}
                      onChange={(event) =>
                        setDeliveryForm({ ...deliveryForm, quantity: event.target.value })
                      }
                    />
                    <small>LITRES</small>
                  </div>
                </label>

                <label>
                  NOTES
                  <input
                    placeholder="Optional delivery note"
                    value={deliveryForm.notes}
                    onChange={(event) =>
                      setDeliveryForm({ ...deliveryForm, notes: event.target.value })
                    }
                  />
                </label>

                <div className="delivery-estimate">
                  <span>ESTIMATED DELIVERY VALUE</span>
                  <strong>{money(estimatedAmount)}</strong>
                </div>

                {formError && <p className="form-error">{formError}</p>}

                <div className="form-actions">
                  <button
                    type="button"
                    className="button-light"
                    onClick={closeModals}
                    disabled={saving}
                  >
                    Cancel
                  </button>
                  <button type="submit" className="button-dark" disabled={saving || activeCustomers.length === 0}>
                    {saving ? "Saving..." : "Record delivery"} <ArrowRight size={16} />
                  </button>
                </div>
              </form>
            )}
          </section>
        </div>
      )}

      {deactivationCustomer && (
        <div
          className="modal-backdrop"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) closeDeactivation();
          }}
        >
          <section className="editorial-modal" role="dialog" aria-modal="true">
            <div className="modal-topline">
              <span>CUSTOMER STATUS</span>
              <button
                className="icon-button"
                onClick={closeDeactivation}
                aria-label="Close deactivation dialog"
                disabled={saving}
              >
                <X size={19} />
              </button>
            </div>
            <div className="modal-title">
              <span className="section-index">CUSTOMER LIFECYCLE / 02</span>
              <h2>Pause deliveries.</h2>
              <p>
                {deactivationCustomer.name} will remain in your records, but new deliveries
                will be blocked until you reactivate this customer.
              </p>
            </div>
            <form
              className="editorial-form"
              onSubmit={(event) => {
                event.preventDefault();
                deactivateCustomer();
              }}
            >
              <label>
                REASON FOR DEACTIVATION <span>*</span>
                <input
                  autoFocus
                  required
                  maxLength={500}
                  placeholder="e.g. Customer has moved away"
                  value={deactivationReason}
                  onChange={(event) => setDeactivationReason(event.target.value)}
                />
              </label>
              {formError && <p className="form-error">{formError}</p>}
              <div className="form-actions">
                <button
                  type="button"
                  className="button-light"
                  disabled={saving}
                  onClick={closeDeactivation}
                >
                  Cancel
                </button>
                <button type="submit" className="button-dark" disabled={saving}>
                  {saving ? "Deactivating..." : "Deactivate customer"}
                  <ArrowRight size={16} />
                </button>
              </div>
            </form>
          </section>
        </div>
      )}
    </div>
  );
}

export default App;
