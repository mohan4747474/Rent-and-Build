import {
  type FormEvent,
  type ReactNode,
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import {
  Activity,
  ArrowLeft,
  ArrowRight,
  Bell,
  CalendarDays,
  Check,
  ChevronDown,
  CircleUserRound,
  ClipboardList,
  Clock3,
  CreditCard,
  Gauge,
  Heart,
  LayoutDashboard,
  LockKeyhole,
  LogIn,
  LogOut,
  MapPin,
  Menu,
  Moon,
  PackagePlus,
  Radio,
  ReceiptText,
  Settings,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
  Sun,
  Truck,
  UserRound,
  Users,
  WalletCards,
  Wrench,
  X,
  Zap,
} from 'lucide-react';
import { shadcn } from '@clerk/themes';
import {
  ClerkProvider,
  SignIn,
  SignUp,
  useAuth,
  useClerk,
  useUser,
} from '@clerk/react';
import { publishableKeyFromHost } from '@clerk/react/internal';
import {
  Link,
  Redirect,
  Route,
  Router as WouterRouter,
  Switch,
  useLocation,
  useParams,
} from 'wouter';
import NotFound from '@/pages/not-found';

const clerkPubKey = publishableKeyFromHost(
  window.location.hostname,
  import.meta.env.VITE_CLERK_PUBLISHABLE_KEY,
);
const clerkProxyUrl = import.meta.env.VITE_CLERK_PROXY_URL;
const basePath = import.meta.env.BASE_URL.replace(/\/$/, '');

// The marketplace remains browsable without Clerk; protected actions show the sign-in route.
// Configure VITE_CLERK_PUBLISHABLE_KEY in production to enable managed authentication.

type Equipment = {
  id: string;
  name: string;
  type: string;
  city: string;
  rating: string;
  reviews: number;
  price: number;
  image: 'excavator' | 'dump' | 'crane' | 'loader' | 'generator';
  tag: string;
  available: string;
  owner: string;
  operatorIncluded: boolean;
};

type UserProfile = { name: string; phone: string; email: string };

type Booking = {
  id: string;
  equipmentId: string;
  equipmentName: string;
  location: string;
  startDate: string;
  endDate: string;
  total: number;
  paymentMethod: string;
  paymentStatus: 'paid' | 'pending';
  status: 'payment-confirmed' | 'confirmed' | 'in-transit' | 'on-site' | 'completed';
  createdAt: string;
};

type AppNotification = {
  id: string;
  title: string;
  body: string;
  kind: 'booking' | 'location' | 'operation' | 'payment' | 'system';
  time: string;
  read: boolean;
};

type SensorData = {
  temperature: number;
  mileage: number;
  workHours: number;
  kmDriven: number;
  fuel: number;
  odometerKm: number;
  latitude: number;
  longitude: number;
  speedKph: number;
  engineRpm: number;
  engineLoad: number;
  batteryVoltage: number;
  oilPressure: number;
  coolantLevel: number;
  fuelRate: number;
  engineStatus: 'Running' | 'Idle' | 'Stopped';
  lastSync: string;
};

const equipmentSeed: Equipment[] = [
  {
    id: 'cat-320',
    name: 'CAT 320 Excavator',
    type: 'Excavator',
    city: 'Bengaluru',
    rating: '4.9',
    reviews: 28,
    price: 4500,
    image: 'excavator',
    tag: 'Most booked',
    available: 'Today',
    owner: 'Kumar Earthmovers',
    operatorIncluded: true,
  },
  {
    id: 'volvo-a40',
    name: 'Volvo A40 Articulated Dump Truck',
    type: 'Dump truck',
    city: 'Hyderabad',
    rating: '4.8',
    reviews: 16,
    price: 6800,
    image: 'dump',
    tag: 'New listing',
    available: 'Tomorrow',
    owner: 'Deccan Haulage',
    operatorIncluded: false,
  },
  {
    id: 'liebherr',
    name: 'Liebherr LTM 1090 Mobile Crane',
    type: 'Crane',
    city: 'Mumbai',
    rating: '4.9',
    reviews: 11,
    price: 12500,
    image: 'crane',
    tag: 'Operator included',
    available: 'In 2 days',
    owner: 'Harbour Lift Co.',
    operatorIncluded: true,
  },
  {
    id: 'jcb-3dx',
    name: 'JCB 3DX Backhoe Loader',
    type: 'Loader',
    city: 'Chennai',
    rating: '4.7',
    reviews: 34,
    price: 3900,
    image: 'loader',
    tag: 'Verified owner',
    available: 'Today',
    owner: 'Southline Machines',
    operatorIncluded: true,
  },
  {
    id: 'cummins-125',
    name: 'Cummins 125 kVA Generator',
    type: 'Generator',
    city: 'Pune',
    rating: '4.8',
    reviews: 19,
    price: 2400,
    image: 'generator',
    tag: 'Quiet set',
    available: 'Today',
    owner: 'Power Yard India',
    operatorIncluded: false,
  },
];

const defaultNotifications: AppNotification[] = [
  {
    id: 'n1',
    title: 'Fleet location updated',
    body: 'CAT 320 is moving toward Whitefield work site.',
    kind: 'location',
    time: '2 min ago',
    read: false,
  },
  {
    id: 'n2',
    title: 'Payment confirmation ready',
    body: 'Your next booking will show payment and booking as separate steps.',
    kind: 'payment',
    time: 'Today',
    read: false,
  },
  {
    id: 'n3',
    title: 'ECU sensor sync online',
    body: 'Temperature, mileage and operating hours are available for connected assets.',
    kind: 'operation',
    time: 'Today',
    read: true,
  },
];

const defaultSensors: Record<string, SensorData> = {
  'cat-320': {
    temperature: 82.4,
    mileage: 777.37,
    workHours: 53.09,
    kmDriven: 0,
    fuel: 78.4,
    odometerKm: 18420,
    latitude: 12.9716,
    longitude: 77.5946,
    speedKph: 18.4,
    engineRpm: 1420,
    engineLoad: 62,
    batteryVoltage: 24.8,
    oilPressure: 4.2,
    coolantLevel: 91,
    fuelRate: 8.6,
    engineStatus: 'Running',
    lastSync: '18 seconds ago',
  },
  'volvo-a40': {
    temperature: 76.2,
    mileage: 0,
    workHours: 418.3,
    kmDriven: 184.7,
    fuel: 62.1,
    odometerKm: 48210,
    latitude: 17.385,
    longitude: 78.4867,
    speedKph: 12.1,
    engineRpm: 1180,
    engineLoad: 48,
    batteryVoltage: 25.1,
    oilPressure: 3.8,
    coolantLevel: 88,
    fuelRate: 12.4,
    engineStatus: 'Idle',
    lastSync: '42 seconds ago',
  },
  'liebherr': {
    temperature: 69.5,
    mileage: 112.2,
    workHours: 214.8,
    kmDriven: 0,
    fuel: 91.8,
    odometerKm: 9210,
    latitude: 19.076,
    longitude: 72.8777,
    speedKph: 0,
    engineRpm: 0,
    engineLoad: 0,
    batteryVoltage: 25.4,
    oilPressure: 0,
    coolantLevel: 95,
    fuelRate: 0,
    engineStatus: 'Stopped',
    lastSync: '1 minute ago',
  },
};

const fmt = (value: number) => new Intl.NumberFormat('en-IN').format(value);

function useStoredState<T>(key: string, initial: T) {
  const [value, setValue] = useState<T>(() => {
    try {
      const stored = localStorage.getItem(key);
      return stored ? (JSON.parse(stored) as T) : initial;
    } catch {
      return initial;
    }
  });
  useEffect(() => {
    localStorage.setItem(key, JSON.stringify(value));
  }, [key, value]);
  return [value, setValue] as const;
}

type AppState = {
  dark: boolean;
  setDark: (value: boolean) => void;
  equipment: Equipment[];
  addEquipment: (item: Equipment) => void;
  favorites: string[];
  toggleFavorite: (id: string) => void;
  profile: UserProfile;
  setProfile: (profile: UserProfile) => void;
  bookings: Booking[];
  addBooking: (booking: Booking) => void;
  notifications: AppNotification[];
  addNotification: (notification: Omit<AppNotification, 'id' | 'time'>) => void;
  markNotificationsRead: () => void;
  sensors: Record<string, SensorData>;
  setSensors: (sensors: Record<string, SensorData>) => void;
};

const AppStateContext = createContext<AppState | null>(null);

function useAppState() {
  const context = useContext(AppStateContext);
  if (!context) throw new Error('useAppState must be used inside AppStateProvider');
  return context;
}

function AppStateProvider({ children }: { children: ReactNode }) {
  const [dark, setDark] = useStoredState('rb-dark', true);
  const [equipment, setEquipment] = useStoredState<Equipment[]>('rb-equipment', equipmentSeed);
  const [favorites, setFavorites] = useStoredState<string[]>('rb-favorites', []);
  const [profile, setProfile] = useStoredState<UserProfile>('rb-profile', {
    name: '',
    phone: '',
    email: '',
  });
  const [bookings, setBookings] = useStoredState<Booking[]>('rb-bookings', []);
  const [notifications, setNotifications] = useStoredState<AppNotification[]>(
    'rb-notifications',
    defaultNotifications,
  );
  const [sensors, setSensors] = useStoredState<Record<string, SensorData>>(
    'rb-sensors',
    defaultSensors,
  );

  const addNotification = (notification: Omit<AppNotification, 'id' | 'time'>) => {
    setNotifications((current) => [
      { ...notification, id: `n-${Date.now()}`, time: 'Just now' },
      ...current,
    ]);
  };

  return (
    <AppStateContext.Provider
      value={{
        dark,
        setDark,
        equipment,
        addEquipment: (item) => setEquipment((current) => [item, ...current]),
        favorites,
        toggleFavorite: (id) =>
          setFavorites((current) =>
            current.includes(id) ? current.filter((item) => item !== id) : [...current, id],
          ),
        profile,
        setProfile,
        bookings,
        addBooking: (booking) => setBookings((current) => [booking, ...current]),
        notifications,
        addNotification,
        markNotificationsRead: () =>
          setNotifications((current) => current.map((item) => ({ ...item, read: true }))),
        sensors,
        setSensors,
      }}
    >
      {children}
    </AppStateContext.Provider>
  );
}

function Logo() {
  return (
    <div className="flex items-center gap-2.5" aria-label="Rent and Build India">
      <div
        className="relative grid h-8 w-8 shrink-0 place-items-center bg-primary text-primary-foreground"
        style={{ clipPath: 'polygon(50% 0,100% 100%,0 100%)' }}
      >
        <span className="display-font mt-2 text-[10px] font-black tracking-tighter">RB</span>
      </div>
      <span className="display-font text-[21px] font-bold tracking-[.03em]">
        RENT <span className="text-primary">&amp;</span> BUILD
      </span>
    </div>
  );
}

function ThemeToggle() {
  const { dark, setDark } = useAppState();
  return (
    <button
      onClick={() => setDark(!dark)}
      className="grid h-9 w-9 place-items-center rounded-full border border-border text-muted-foreground transition-colors hover:border-primary hover:text-primary"
      aria-label={dark ? 'Use light theme' : 'Use dark theme'}
    >
      {dark ? <Sun size={16} /> : <Moon size={16} />}
    </button>
  );
}

function Header({ onMenu }: { onMenu?: () => void }) {
  const { favorites, notifications } = useAppState();
  const { isSignedIn } = useAuth();
  const unread = notifications.filter((item) => !item.read).length;
  return (
    <header className="sticky top-0 z-40 border-b border-border/80 bg-background/90 backdrop-blur-xl">
      <div className="mx-auto flex h-[72px] max-w-[1440px] items-center justify-between gap-5 px-5 lg:px-9">
        <Link href="/">
          <Logo />
        </Link>
        <nav className="hidden items-center gap-6 lg:flex" aria-label="Primary navigation">
          <Link href="/browse" className="text-xs font-semibold text-foreground/75 hover:text-primary">Browse equipment</Link>
          <Link href="/fleet" className="text-xs font-semibold text-foreground/75 hover:text-primary">ECU fleet</Link>
          <Link href="/owner/listings" className="text-xs font-semibold text-foreground/75 hover:text-primary">List your equipment</Link>
          <Link href="/how-it-works" className="text-xs font-semibold text-foreground/75 hover:text-primary">How it works</Link>
        </nav>
        <div className="flex items-center gap-2">
          <ThemeToggle />
          {isSignedIn && (
            <>
              <Link
                href="/notifications"
                className="relative grid h-9 w-9 place-items-center rounded-full border border-border text-muted-foreground hover:border-primary hover:text-primary"
                aria-label={`${unread} unread notifications`}
              >
                <Bell size={16} />
                {unread > 0 && <span className="absolute -right-1 -top-1 grid h-4 min-w-4 place-items-center rounded-full bg-primary px-1 text-[9px] font-bold text-primary-foreground">{unread}</span>}
              </Link>
              <Link href="/profile" className="hidden h-9 items-center gap-2 rounded-full border border-border px-3 text-xs font-semibold hover:border-primary sm:flex">
                <CircleUserRound size={15} className="text-primary" /> Account
              </Link>
            </>
          )}
          {!isSignedIn && (
            <Link href="/sign-in" className="hidden h-9 items-center gap-2 border border-border px-3 text-xs font-bold hover:border-primary hover:text-primary sm:flex">
              <LogIn size={14} /> Sign in
            </Link>
          )}
          <Link href="/browse" className="hidden h-9 items-center gap-2 bg-primary px-4 text-xs font-bold text-primary-foreground hover:brightness-110 sm:flex">
            GET A QUOTE <ArrowRight size={14} />
          </Link>
          {onMenu && <button onClick={onMenu} className="grid h-9 w-9 place-items-center rounded-full border border-border lg:hidden" aria-label="Open navigation"><Menu size={18} /></button>}
        </div>
      </div>
      {favorites.length > 0 && <div className="hidden border-t border-border/60 bg-primary/5 px-5 py-1.5 text-center text-[10px] text-muted-foreground md:block">{favorites.length} saved machine{favorites.length === 1 ? '' : 's'} ready for comparison</div>}
    </header>
  );
}

function MobileMenu({ close }: { close: () => void }) {
  return (
    <div className="fixed inset-0 z-50 bg-background/98 p-5 backdrop-blur-xl lg:hidden">
      <div className="flex items-center justify-between"><Logo /><button onClick={close} className="grid h-10 w-10 place-items-center rounded-full border border-border" aria-label="Close navigation"><X size={18} /></button></div>
      <nav className="mt-12 grid gap-2" aria-label="Mobile navigation">
        {[
          ['/browse', 'Browse equipment'],
          ['/bookings', 'My bookings'],
          ['/fleet', 'ECU fleet tracking'],
          ['/owner/listings', 'Owner listings'],
          ['/admin/login', 'Admin console'],
          ['/notifications', 'Notifications'],
        ].map(([href, text]) => <Link key={href} onClick={close} href={href} className="border-b border-border py-4 text-2xl font-semibold">{text}</Link>)}
      </nav>
    </div>
  );
}

function PageFrame({ children, wide = false }: { children: ReactNode; wide?: boolean }) {
  const [menuOpen, setMenuOpen] = useState(false);
  return (
    <div className="min-h-[100dvh] bg-background text-foreground">
      <Header onMenu={() => setMenuOpen(true)} />
      {menuOpen && <MobileMenu close={() => setMenuOpen(false)} />}
      <main className={wide ? '' : 'mx-auto max-w-[1440px]'}>{children}</main>
      <footer className="border-t border-border">
        <div className="mx-auto flex max-w-[1440px] flex-col justify-between gap-5 px-5 py-8 text-xs text-muted-foreground md:flex-row md:items-center lg:px-9">
          <div><Logo /><p className="mt-3 max-w-xs leading-5">The dependable way to rent construction equipment across India.</p></div>
          <div className="flex flex-wrap items-center gap-5"><Link href="/notifications" className="hover:text-primary">Notifications</Link><Link href="/profile" className="hover:text-primary">Account</Link><span className="mono-font text-[10px]">RB / 2026</span></div>
        </div>
      </footer>
    </div>
  );
}

function SectionLabel({ eyebrow, title, body }: { eyebrow: string; title: string; body?: string }) {
  return <div className="mb-7"><div className="mono-font mb-2 flex items-center gap-2 text-[10px] font-bold uppercase tracking-[.2em] text-primary"><span className="h-px w-7 bg-primary" />{eyebrow}</div><h2 className="display-font text-4xl font-bold uppercase leading-[.92] tracking-tight md:text-5xl">{title}</h2>{body && <p className="mt-3 max-w-xl text-sm leading-6 text-muted-foreground">{body}</p>}</div>;
}

function EquipmentIllustration({ kind, initials }: { kind: Equipment['image']; initials?: string }) {
  return (
    <div className="equipment-art flex h-full min-h-[145px] items-center justify-center">
      <div className="relative z-[1] text-center">
        <div className="relative mx-auto mb-2 h-[74px] w-[116px] text-2xl font-black tracking-tight text-amber-200">
          {kind === 'excavator' && <><div className="absolute bottom-0 left-0 h-3 w-28 rounded-full bg-[#0b111a] shadow-[0_5px_0_#36475b]" /><div className="absolute bottom-3 left-8 h-9 w-10 rounded-tl-2xl bg-primary" /><div className="absolute bottom-11 left-12 h-3 w-14 -rotate-12 bg-primary" /><div className="absolute bottom-12 right-0 h-3 w-12 rotate-[28deg] bg-primary" /><div className="absolute right-[-4px] top-0 h-7 w-8 rotate-[35deg] border-4 border-primary border-l-0" /></>}
          {kind === 'dump' && <><div className="absolute bottom-3 left-3 h-9 w-24 rounded-md bg-primary" /><div className="absolute bottom-0 left-3 h-4 w-5 rounded-full bg-[#0b111a]" /><div className="absolute bottom-0 right-4 h-4 w-5 rounded-full bg-[#0b111a]" /><div className="absolute left-10 top-1 h-7 w-8 border-2 border-primary bg-[#2e3b47]" /><div className="absolute right-0 top-6 h-9 w-12 -skew-x-12 rounded-sm bg-[#e6b32f]" /></>}
          {kind === 'crane' && <><div className="absolute bottom-0 left-0 h-3 w-28 bg-[#0b111a]" /><div className="absolute bottom-2 left-12 h-12 w-3 bg-primary" /><div className="absolute bottom-[3.25rem] left-13 h-2 w-24 origin-left rotate-[-9deg] bg-primary" /><div className="absolute bottom-0 right-2 h-3 w-3 rounded-full bg-primary" /></>}
          {kind === 'loader' && <><div className="absolute bottom-0 left-1 h-4 w-24 rounded-full bg-[#0b111a]" /><div className="absolute bottom-3 left-10 h-8 w-12 rounded-md bg-primary" /><div className="absolute bottom-9 left-20 h-3 w-10 rotate-[-28deg] bg-primary" /><div className="absolute bottom-1 right-[-2px] h-8 w-10 -skew-x-12 rounded-b-lg border-4 border-primary" /></>}
          {kind === 'generator' && <><div className="absolute bottom-0 left-5 h-12 w-20 rounded-sm border-4 border-primary bg-[#293848]" /><div className="absolute bottom-3 left-9 h-2 w-12 bg-primary/60" /><div className="absolute bottom-0 left-3 h-2 w-5 bg-[#0b111a]" /><div className="absolute bottom-0 right-3 h-2 w-5 bg-[#0b111a]" /></>}
        </div>
        <span className="mono-font text-[10px] font-bold tracking-[.2em] text-slate-400">{initials ?? 'RB'} / ECU READY</span>
      </div>
    </div>
  );
}

function HomePage() {
  const { equipment } = useAppState();
  return (
    <PageFrame wide>
      <section className="noise grid-lines relative overflow-hidden border-b border-border/70">
        <div className="mx-auto grid max-w-[1440px] items-center gap-12 px-5 py-16 md:py-24 lg:grid-cols-[1.08fr_.92fr] lg:px-9 lg:py-28">
          <div>
            <div className="animate-rise inline-flex items-center gap-2 border border-primary/30 bg-primary/10 px-3 py-1.5 text-[10px] font-bold uppercase tracking-[.16em] text-primary"><span className="h-1.5 w-1.5 rounded-full bg-primary" />India's equipment exchange</div>
            <h1 className="display-font animate-rise-2 mt-6 max-w-[700px] text-[clamp(4.25rem,9vw,8.2rem)] font-bold uppercase leading-[.82] tracking-[-.045em]">Heavy work.<br /><span className="text-primary">Light lift.</span></h1>
            <p className="animate-rise-3 mt-7 max-w-[560px] text-base leading-7 text-muted-foreground md:text-lg">Rent excavators, cranes, dump trucks and the crew to run them — from verified owners, with clear rates, protected checkout, and live job visibility.</p>
            <div className="mt-8 flex flex-wrap items-center gap-4"><Link href="/browse" className="group flex h-12 items-center gap-3 bg-primary px-5 text-sm font-bold text-primary-foreground hover:gap-5">BROWSE THE YARD <ArrowRight size={17} /></Link><Link href="/how-it-works" className="flex items-center gap-2 text-sm font-semibold text-foreground/75 hover:text-primary">See how it works <ChevronDown size={15} /></Link></div>
            <div className="mt-12 flex flex-wrap items-center gap-x-8 gap-y-3 border-t border-border/60 pt-5 text-[11px] text-muted-foreground"><span className="flex items-center gap-2"><ShieldCheck size={15} className="text-primary" />Verified equipment</span><span className="flex items-center gap-2"><Clock3 size={15} className="text-primary" />Response in under 10 min</span><span className="flex items-center gap-2"><MapPin size={15} className="text-primary" />25+ Indian cities</span></div>
          </div>
          <div className="border border-border bg-card p-5 shadow-2xl shadow-black/20 md:p-6">
            <div className="mono-font flex items-center justify-between text-[10px] font-bold uppercase tracking-[.17em] text-muted-foreground"><span>Instant quote / 01</span><span className="text-primary">RB-INDIA</span></div>
            <h2 className="display-font mt-5 text-3xl font-bold uppercase">Start with the job.</h2>
            <p className="mt-1 text-xs text-muted-foreground">Find a machine, connect your account, and book with a clear handoff.</p>
            <div className="mt-6 grid gap-3">
              <Link href="/browse" className="flex h-12 items-center justify-between border border-input bg-background px-4 text-sm hover:border-primary"><span className="flex items-center gap-2"><Wrench size={16} className="text-primary" /> Browse all equipment</span><ArrowRight size={15} /></Link>
              <Link href="/owner/listings/new" className="flex h-12 items-center justify-between border border-input bg-background px-4 text-sm hover:border-primary"><span className="flex items-center gap-2"><PackagePlus size={16} className="text-primary" /> List a machine</span><ArrowRight size={15} /></Link>
              <Link href="/fleet" className="flex h-12 items-center justify-between border border-input bg-background px-4 text-sm hover:border-primary"><span className="flex items-center gap-2"><Radio size={16} className="text-primary" /> View ECU telemetry</span><ArrowRight size={15} /></Link>
            </div>
            <div className="mt-6 grid grid-cols-3 gap-px bg-border">{[['01', 'Browse'], ['02', 'Pay'], ['03', 'Operate']].map(([number, label]) => <div key={number} className="bg-card px-3 py-3"><div className="mono-font text-[10px] text-primary">/ {number}</div><div className="mt-1 text-xs font-bold">{label}</div></div>)}</div>
          </div>
        </div>
      </section>
      <section className="mx-auto max-w-[1440px] px-5 py-16 lg:px-9 lg:py-24"><SectionLabel eyebrow="The yard / 01" title="Machines that are ready." body="Compare live listings from owners who keep their machines maintained and their calendars honest." /><div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">{equipment.slice(0, 4).map((item) => <EquipmentCard key={item.id} item={item} />)}</div><div className="mt-8 flex justify-center"><Link href="/browse" className="flex items-center gap-2 border border-border px-5 py-3 text-xs font-bold hover:border-primary hover:text-primary">VIEW ALL EQUIPMENT <ArrowRight size={14} /></Link></div></section>
      <section className="border-y border-border bg-primary text-primary-foreground"><div className="mx-auto grid max-w-[1440px] gap-10 px-5 py-14 lg:grid-cols-[.75fr_1.25fr] lg:px-9 lg:py-20"><div><div className="mono-font flex items-center gap-2 text-[10px] font-bold uppercase tracking-[.2em] opacity-75"><span className="h-px w-7 bg-current" />Built around the job</div><h2 className="display-font mt-4 max-w-md text-5xl font-bold uppercase leading-[.9] md:text-6xl">One system for every moving part.</h2></div><div className="grid gap-8 sm:grid-cols-3">{[['01', 'Search', 'Compare equipment, rates, operators, and locations.'], ['02', 'Book', 'Confirm customer details, authorize payment, then lock the booking.'], ['03', 'Operate', 'Track asset location, ECU sensors, and job status.']].map(([n, title, body]) => <div key={n} className="border-t border-primary-foreground/40 pt-4"><span className="mono-font text-xs font-bold opacity-70">{n}</span><h3 className="mt-7 text-lg font-bold">{title}</h3><p className="mt-2 text-xs leading-5 opacity-75">{body}</p></div>)}</div></div></section>
    </PageFrame>
  );
}

function EquipmentCard({ item }: { item: Equipment }) {
  const { favorites, toggleFavorite } = useAppState();
  const saved = favorites.includes(item.id);
  return (
    <article className="group overflow-hidden border border-border bg-card transition-all duration-300 hover:-translate-y-1 hover:border-primary/60 hover:shadow-xl hover:shadow-black/15">
      <div className="relative"><EquipmentIllustration kind={item.image} initials={item.type.slice(0, 3).toUpperCase()} /><span className="absolute left-3 top-3 bg-background/90 px-2 py-1 text-[9px] font-bold uppercase tracking-wider">{item.tag}</span><button onClick={() => toggleFavorite(item.id)} className={`absolute right-3 top-3 grid h-8 w-8 place-items-center border border-border/80 bg-background/85 hover:text-primary ${saved ? 'text-primary' : ''}`} aria-label={`Save ${item.name}`}><Heart size={15} fill={saved ? 'currentColor' : 'none'} /></button></div>
      <div className="p-4"><div className="mono-font text-[9px] uppercase tracking-[.14em] text-primary">{item.type}</div><h3 className="mt-1 text-sm font-bold leading-5">{item.name}</h3><div className="mt-3 flex items-center gap-1.5 text-xs text-muted-foreground"><MapPin size={13} />{item.city}<span className="mx-1 text-border">/</span><span className="text-emerald-400">{item.available}</span></div><div className="mt-4 flex items-end justify-between border-t border-border pt-4"><div><span className="text-lg font-bold text-primary">₹{fmt(item.price)}</span><span className="text-[10px] text-muted-foreground"> / day</span></div><Link href={`/booking/${item.id}`} className="flex items-center gap-1.5 bg-primary px-3 py-2 text-[11px] font-bold text-primary-foreground hover:gap-2.5">BOOK <ArrowRight size={13} /></Link></div></div>
    </article>
  );
}

function BrowsePage() {
  const { equipment } = useAppState();
  const [query, setQuery] = useState('');
  const [city, setCity] = useState('All cities');
  const [type, setType] = useState('All equipment');
  const filtered = equipment.filter((item) => (type === 'All equipment' || item.type === type) && (city === 'All cities' || item.city === city) && `${item.name} ${item.city} ${item.owner}`.toLowerCase().includes(query.toLowerCase()));
  return <PageFrame><div className="px-5 py-12 lg:px-9 lg:py-20"><div className="flex flex-col justify-between gap-5 border-b border-border pb-8 md:flex-row md:items-end"><div><SectionLabel eyebrow="Equipment directory / 02" title="Find the right machine." body="Filter the marketplace by machine, city, or owner, then continue into a protected booking flow." /><div className="flex items-center gap-2 text-xs text-emerald-400"><span className="h-2 w-2 rounded-full bg-emerald-400" />{filtered.length} matching listing{filtered.length === 1 ? '' : 's'}</div></div><Link href="/owner/listings/new" className="flex h-11 items-center gap-2 border border-primary px-4 text-xs font-bold text-primary hover:bg-primary hover:text-primary-foreground"><PackagePlus size={15} /> LIST A MACHINE</Link></div><div className="mt-7 grid gap-3 border border-border bg-card p-4 md:grid-cols-[1.2fr_.8fr_.8fr]"><label className="relative block"><span className="mono-font mb-1.5 block text-[9px] uppercase tracking-wider text-muted-foreground">Search listings</span><Wrench className="absolute left-3 top-9 text-muted-foreground" size={15} /><input value={query} onChange={(e) => setQuery(e.target.value)} className="h-11 w-full border border-input bg-background pl-9 pr-3 text-sm" placeholder="CAT, dump truck, owner..." /></label><label><span className="mono-font mb-1.5 block text-[9px] uppercase tracking-wider text-muted-foreground">Machine type</span><select value={type} onChange={(e) => setType(e.target.value)} className="h-11 w-full border border-input bg-background px-3 text-sm"><option>All equipment</option><option>Excavator</option><option>Dump truck</option><option>Crane</option><option>Loader</option><option>Generator</option></select></label><label><span className="mono-font mb-1.5 block text-[9px] uppercase tracking-wider text-muted-foreground">City</span><select value={city} onChange={(e) => setCity(e.target.value)} className="h-11 w-full border border-input bg-background px-3 text-sm"><option>All cities</option>{Array.from(new Set(equipment.map((item) => item.city))).map((item) => <option key={item}>{item}</option>)}</select></label></div><div className="mt-8 grid gap-5 sm:grid-cols-2 xl:grid-cols-4">{filtered.map((item) => <EquipmentCard key={item.id} item={item} />)}</div>{filtered.length === 0 && <div className="border border-dashed border-border py-16 text-center"><Wrench className="mx-auto mb-3 text-muted-foreground" /><p className="font-semibold">No machines match these filters.</p><button onClick={() => { setQuery(''); setType('All equipment'); setCity('All cities'); }} className="mt-3 text-xs font-bold text-primary underline underline-offset-4">Reset filters</button></div>}</div></PageFrame>;
}

function HowItWorksPage() {
  return <PageFrame><div className="px-5 py-12 lg:px-9 lg:py-20"><SectionLabel eyebrow="Operating model / 03" title="A booking that does not leave gaps." body="Customers, owners, operators, and administrators see the same state changes — from the first request to the last work hour." /><div className="grid gap-4 md:grid-cols-3">{[['01', 'Customer details', 'Sign in with Clerk, then keep name, phone, and email attached to the booking request.'], ['02', 'Payment authorization', 'Choose a method and complete the payment step before the booking is confirmed.'], ['03', 'Booking confirmation', 'Once payment is successful, the owner receives a confirmed work order and the customer can track it.'], ['04', 'Fleet telemetry', 'ECU-enabled machines report temperature, mileage, work hours, fuel, and movement.'], ['05', 'Operations status', 'Location, transit, on-site, idle, and completed states are visible as notifications.'], ['06', 'Owner console', 'Owners can add machines, set rates, and monitor active work orders from a separate portal.']].map(([number, title, body]) => <div key={number} className="border border-border bg-card p-5"><div className="mono-font text-[10px] text-primary">/ {number}</div><h3 className="mt-5 text-lg font-bold">{title}</h3><p className="mt-2 text-sm leading-6 text-muted-foreground">{body}</p></div>)}</div></div></PageFrame>;
}

function AuthPage({ mode }: { mode: 'sign-in' | 'sign-up' }) {
  const path = `${basePath}/${mode}`;
  const AuthComponent = mode === 'sign-in' ? SignIn : SignUp;
  return <div className="flex min-h-[100dvh] items-center justify-center bg-background px-4 py-10"><div className="w-full max-w-5xl"><div className="mb-8 flex justify-center"><Link href="/"><Logo /></Link></div><div className="grid gap-8 lg:grid-cols-[.8fr_1fr] lg:items-center"><div className="hidden lg:block"><div className="mono-font flex items-center gap-2 text-[10px] font-bold uppercase tracking-[.2em] text-primary"><span className="h-px w-7 bg-primary" />Access / RB India</div><h1 className="display-font mt-4 text-6xl font-bold uppercase leading-[.86]">Your next shift starts here.</h1><p className="mt-6 max-w-md text-sm leading-6 text-muted-foreground">Use your customer account to save machines, confirm a payment, track a booking, and keep every job detail in one place.</p><div className="mt-7 grid gap-3 text-xs text-muted-foreground"><div className="flex items-center gap-3"><ShieldCheck size={16} className="text-primary" />Verified marketplace accounts</div><div className="flex items-center gap-3"><LockKeyhole size={16} className="text-primary" />Protected sign-in with Clerk</div><div className="flex items-center gap-3"><Bell size={16} className="text-primary" />Booking and fleet status notifications</div></div></div><div className="flex justify-center"><AuthComponent routing="path" path={path} signInUrl={`${basePath}/sign-in`} signUpUrl={`${basePath}/sign-up`} appearance={clerkAppearance} /></div></div></div></div>;
}

function AdminLoginPage() {
  const { isSignedIn } = useAuth();
  return <div className="flex min-h-[100dvh] items-center justify-center bg-background px-5"><div className="w-full max-w-md border border-border bg-card p-7"><Link href="/" className="mb-10 inline-flex"><Logo /></Link><div className="grid h-12 w-12 place-items-center bg-primary text-primary-foreground"><ShieldCheck size={22} /></div><h1 className="display-font mt-6 text-4xl font-bold uppercase">Admin access</h1><p className="mt-2 text-sm leading-6 text-muted-foreground">A separate console for users, bookings, notifications, and ECU operations. Admin permissions are applied to your managed account.</p>{isSignedIn ? <Link href="/admin" className="mt-7 flex h-12 items-center justify-center gap-2 bg-primary text-sm font-bold text-primary-foreground">CONTINUE TO ADMIN CONSOLE <ArrowRight size={15} /></Link> : <Link href="/sign-in" className="mt-7 flex h-12 items-center justify-center gap-2 bg-primary text-sm font-bold text-primary-foreground">SIGN IN AS ADMIN <LogIn size={15} /></Link>}<Link href="/" className="mt-5 flex items-center justify-center gap-2 text-xs font-semibold text-muted-foreground hover:text-primary"><ArrowLeft size={13} /> Back to marketplace</Link></div></div>;
}

function ProtectedPage({ children }: { children: ReactNode }) {
  const { isLoaded, isSignedIn } = useAuth();
  if (!isLoaded) return <LoadingPage />;
  if (!isSignedIn) return <Redirect to="/sign-in" />;
  return <>{children}</>;
}

function LoadingPage() {
  return <div className="grid min-h-[100dvh] place-items-center bg-background text-foreground"><div className="text-center"><div className="mx-auto h-9 w-9 animate-spin rounded-full border-2 border-border border-t-primary" /><p className="mono-font mt-4 text-[10px] uppercase tracking-widest text-muted-foreground">Loading workspace</p></div></div>;
}

function ProfilePage() {
  const { profile, setProfile, addNotification } = useAppState();
  const { user } = useUser();
  const [form, setForm] = useState(profile);
  const save = (event: FormEvent) => { event.preventDefault(); setProfile(form); addNotification({ title: 'Profile details updated', body: 'Your customer details are ready for the next booking.', kind: 'system', read: false }); };
  return <PageFrame><div className="px-5 py-12 lg:px-9 lg:py-20"><SectionLabel eyebrow="Account / 01" title="Your customer details." body="These details are required before payment so the owner knows who is responsible for the job site." /><div className="grid max-w-4xl gap-8 lg:grid-cols-[.7fr_1fr]"><div className="border border-border bg-card p-6"><div className="grid h-14 w-14 place-items-center bg-primary text-primary-foreground"><UserRound size={26} /></div><h3 className="mt-5 text-xl font-bold">{user?.fullName || form.name || 'Customer account'}</h3><p className="mt-2 text-sm leading-6 text-muted-foreground">{user?.primaryEmailAddress?.emailAddress || form.email || 'Add your contact details to unlock bookings.'}</p><div className="mt-7 space-y-3 text-xs text-muted-foreground"><div className="flex items-center gap-2"><Check size={14} className="text-emerald-400" />Clerk sign-in connected</div><div className="flex items-center gap-2"><Check size={14} className={form.phone ? 'text-emerald-400' : 'text-muted-foreground'} />Phone number {form.phone ? 'saved' : 'still required'}</div></div></div><form onSubmit={save} className="border border-border bg-card p-6"><div className="grid gap-4"><label><span className="mono-font mb-1.5 block text-[9px] uppercase tracking-wider text-muted-foreground">Full name *</span><input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="h-11 w-full border border-input bg-background px-3 text-sm" placeholder="Your name" /></label><label><span className="mono-font mb-1.5 block text-[9px] uppercase tracking-wider text-muted-foreground">Phone number *</span><input required type="tel" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} className="h-11 w-full border border-input bg-background px-3 text-sm" placeholder="+91 98765 43210" /></label><label><span className="mono-font mb-1.5 block text-[9px] uppercase tracking-wider text-muted-foreground">Email ID *</span><input required type="email" value={form.email || user?.primaryEmailAddress?.emailAddress || ''} onChange={(e) => setForm({ ...form, email: e.target.value })} className="h-11 w-full border border-input bg-background px-3 text-sm" placeholder="you@company.com" /></label></div><button className="mt-6 flex h-11 w-full items-center justify-center gap-2 bg-primary text-xs font-bold text-primary-foreground"><Check size={15} /> SAVE CUSTOMER DETAILS</button></form></div></div></PageFrame>;
}

function BookingPage() {
  const { id } = useParams<{ id: string }>();
  const { equipment, profile, setProfile, addBooking, addNotification } = useAppState();
  const { user } = useUser();
  const [, setLocation] = useLocation();
  const item = equipment.find((machine) => machine.id === id) ?? equipment[0];
  const [step, setStep] = useState(1);
  const [details, setDetails] = useState<UserProfile>({ name: profile.name || user?.fullName || '', phone: profile.phone, email: profile.email || user?.primaryEmailAddress?.emailAddress || '' });
  const [paymentMethod, setPaymentMethod] = useState('UPI / VPA');
  const [paymentStatus, setPaymentStatus] = useState<'idle' | 'authorizing' | 'paid'>('idle');
  const [bookingId, setBookingId] = useState('');
  const [location, setDeliveryLocation] = useState(item.city);
  const total = Math.round(item.price * 6 * 1.26);
  const saveDetails = (event: FormEvent) => { event.preventDefault(); setProfile(details); addNotification({ title: 'Booking details saved', body: `${details.name}, your contact details are attached to this request.`, kind: 'booking', read: false }); setStep(2); };
  const authorizePayment = () => { setPaymentStatus('authorizing'); window.setTimeout(() => { setPaymentStatus('paid'); addNotification({ title: 'Payment authorized', body: `Payment preference ${paymentMethod} is ready for ${item.name}.`, kind: 'payment', read: false }); setStep(3); }, 900); };
  const confirmBooking = () => { const newId = `RB-${String(Date.now()).slice(-6)}`; setBookingId(newId); addBooking({ id: newId, equipmentId: item.id, equipmentName: item.name, location, startDate: '2026-09-24', endDate: '2026-09-30', total, paymentMethod, paymentStatus: 'paid', status: 'confirmed', createdAt: new Date().toISOString() }); addNotification({ title: 'Booking confirmed', body: `${item.name} is reserved for ${location}.`, kind: 'booking', read: false }); setStep(4); };
  return <PageFrame><div className="px-5 py-12 lg:px-9 lg:py-20"><Link href="/browse" className="mb-7 inline-flex items-center gap-2 text-xs font-semibold text-muted-foreground hover:text-primary"><ArrowLeft size={14} /> Back to equipment</Link><div className="grid gap-8 lg:grid-cols-[1fr_.75fr]"><div><div className="mono-font text-[10px] uppercase tracking-[.18em] text-primary">Protected booking / {String(step).padStart(2, '0')} of 04</div><h1 className="display-font mt-3 text-5xl font-bold uppercase leading-[.9]">{step === 1 ? 'Confirm who is booking.' : step === 2 ? 'Choose payment.' : step === 3 ? 'Review before booking.' : 'Your machine is reserved.'}</h1><div className="mt-8 grid grid-cols-4 gap-2">{[['1', 'Details'], ['2', 'Payment'], ['3', 'Review'], ['4', 'Confirmed']].map(([number, label], index) => <div key={number} className={`border-t-2 pt-2 ${step > index ? 'border-primary text-foreground' : 'border-border text-muted-foreground'}`}><div className="mono-font text-[10px]">{number}</div><div className="mt-1 text-[10px] font-semibold">{label}</div></div>)}</div>{step === 1 && <form onSubmit={saveDetails} className="mt-8 max-w-xl border border-border bg-card p-6"><div className="mb-6 flex items-start gap-3 border-l-2 border-primary bg-primary/5 p-4 text-xs leading-5 text-muted-foreground"><LockKeyhole size={16} className="mt-0.5 shrink-0 text-primary" />Name, phone number, and email ID are required before a payment can be authorized.</div><div className="grid gap-4"><label><span className="mono-font mb-1.5 block text-[9px] uppercase tracking-wider text-muted-foreground">Full name *</span><input required value={details.name} onChange={(e) => setDetails({ ...details, name: e.target.value })} className="h-11 w-full border border-input bg-background px-3 text-sm" placeholder="Responsible person" /></label><label><span className="mono-font mb-1.5 block text-[9px] uppercase tracking-wider text-muted-foreground">Phone number *</span><input required type="tel" value={details.phone} onChange={(e) => setDetails({ ...details, phone: e.target.value })} className="h-11 w-full border border-input bg-background px-3 text-sm" placeholder="+91 98765 43210" /></label><label><span className="mono-font mb-1.5 block text-[9px] uppercase tracking-wider text-muted-foreground">Email ID *</span><input required type="email" value={details.email} onChange={(e) => setDetails({ ...details, email: e.target.value })} className="h-11 w-full border border-input bg-background px-3 text-sm" placeholder="you@company.com" /></label><label><span className="mono-font mb-1.5 block text-[9px] uppercase tracking-wider text-muted-foreground">Delivery location *</span><input required value={location} onChange={(e) => setDeliveryLocation(e.target.value)} className="h-11 w-full border border-input bg-background px-3 text-sm" placeholder="Job site city" /></label></div><button className="mt-6 flex h-11 w-full items-center justify-center gap-2 bg-primary text-xs font-bold text-primary-foreground">CONTINUE TO PAYMENT <ArrowRight size={15} /></button></form>}{step === 2 && <div className="mt-8 max-w-xl border border-border bg-card p-6"><div className="flex items-center justify-between"><div><div className="mono-font text-[10px] uppercase tracking-wider text-primary">Payment authorization</div><h2 className="mt-2 text-xl font-bold">Select a payment method.</h2></div><CreditCard className="text-primary" /></div><div className="mt-6 grid gap-3 sm:grid-cols-3">{['UPI / VPA', 'Card', 'Net banking'].map((method) => <button key={method} onClick={() => setPaymentMethod(method)} className={`min-h-[92px] border p-3 text-left ${paymentMethod === method ? 'border-primary bg-primary/10' : 'border-border hover:border-primary/60'}`}><div className="grid h-7 w-7 place-items-center bg-background text-primary">{method === 'UPI / VPA' ? <Zap size={14} /> : method === 'Card' ? <CreditCard size={14} /> : <WalletCards size={14} />}</div><div className="mt-3 text-xs font-bold">{method}</div></button>)}</div><div className="mt-6 border-t border-border pt-4 text-xs text-muted-foreground">Payments are shown in presentation mode until a billing connector is connected. No money is charged in this preview.</div><button onClick={authorizePayment} disabled={paymentStatus === 'authorizing'} className="mt-6 flex h-11 w-full items-center justify-center gap-2 bg-primary text-xs font-bold text-primary-foreground disabled:opacity-60">{paymentStatus === 'authorizing' ? 'AUTHORIZING PAYMENT…' : 'AUTHORIZE PAYMENT'} <ArrowRight size={15} /></button></div>}{step === 3 && <div className="mt-8 max-w-xl border border-border bg-card p-6"><div className="flex items-start gap-3 border border-emerald-400/30 bg-emerald-400/10 p-4"><Check size={18} className="text-emerald-400" /><div><div className="text-sm font-bold">Payment authorized</div><div className="mt-1 text-xs text-muted-foreground">Now confirm the booking separately so the owner can receive the work order.</div></div></div><div className="mt-6 space-y-3 text-sm"><div className="flex justify-between border-b border-border pb-3"><span className="text-muted-foreground">Customer</span><b>{details.name}</b></div><div className="flex justify-between border-b border-border pb-3"><span className="text-muted-foreground">Delivery</span><b>{location}</b></div><div className="flex justify-between border-b border-border pb-3"><span className="text-muted-foreground">Payment</span><b>{paymentMethod}</b></div><div className="flex justify-between pt-2"><span className="font-bold">Total</span><b className="text-xl text-primary">₹{fmt(total)}</b></div></div><button onClick={confirmBooking} className="mt-7 flex h-12 w-full items-center justify-center gap-2 bg-primary text-sm font-bold text-primary-foreground">CONFIRM BOOKING <Check size={16} /></button></div>}{step === 4 && <div className="mt-8 max-w-xl border border-emerald-400/30 bg-emerald-400/10 p-6"><div className="grid h-12 w-12 place-items-center rounded-full bg-emerald-400 text-[#132219]"><Check size={23} /></div><h2 className="mt-5 text-2xl font-bold">Booking confirmed.</h2><p className="mt-2 text-sm leading-6 text-muted-foreground">The owner has been notified and the equipment is reserved for your site. Your payment authorization and booking confirmation are both recorded.</p><div className="mt-6 grid gap-3 sm:grid-cols-2"><div className="border border-border bg-background/40 p-4"><div className="text-xs text-muted-foreground">Booking ID</div><div className="mt-1 font-bold">{bookingId}</div></div><div className="border border-border bg-background/40 p-4"><div className="text-xs text-muted-foreground">Next state</div><div className="mt-1 font-bold text-primary">Owner confirmation</div></div></div><div className="mt-6 flex flex-wrap gap-3"><Link href="/bookings" className="flex h-11 items-center gap-2 bg-primary px-4 text-xs font-bold text-primary-foreground">VIEW MY BOOKINGS <ArrowRight size={14} /></Link><Link href="/notifications" className="flex h-11 items-center gap-2 border border-border px-4 text-xs font-bold hover:border-primary"><Bell size={14} /> VIEW NOTIFICATIONS</Link></div></div>}</div><aside className="h-fit border border-border bg-card p-5 lg:sticky lg:top-24"><div className="mono-font text-[10px] uppercase tracking-wider text-primary">Selected equipment</div><div className="mt-4"><EquipmentIllustration kind={item.image} initials={item.type.slice(0, 3).toUpperCase()} /><h2 className="mt-4 text-lg font-bold">{item.name}</h2><div className="mt-2 flex items-center gap-2 text-xs text-muted-foreground"><MapPin size={13} />{item.city} · {item.owner}</div></div><div className="mt-5 space-y-3 border-t border-border pt-4 text-xs"><div className="flex justify-between"><span className="text-muted-foreground">Rental × 6 days</span><span>₹{fmt(item.price * 6)}</span></div><div className="flex justify-between"><span className="text-muted-foreground">Delivery &amp; platform</span><span>₹{fmt(Math.round(item.price * 6 * .08))}</span></div><div className="flex justify-between"><span className="text-muted-foreground">GST</span><span>₹{fmt(Math.round(item.price * 6 * .18))}</span></div><div className="flex justify-between border-t border-border pt-3 text-sm font-bold"><span>Estimated total</span><span className="text-primary">₹{fmt(total)}</span></div></div><div className="mt-5 flex items-center gap-2 text-[10px] text-muted-foreground"><ShieldCheck size={14} className="text-primary" />Rate locked before confirmation</div></aside></div></div></PageFrame>;
}

function BookingsPage() {
  const { bookings } = useAppState();
  return <PageFrame><div className="px-5 py-12 lg:px-9 lg:py-20"><SectionLabel eyebrow="Customer portal / 02" title="My bookings." body="Payment, booking, location, and operation status stay visible after confirmation." /><div className="grid gap-4">{bookings.length === 0 ? <div className="border border-dashed border-border p-12 text-center"><ClipboardList className="mx-auto mb-3 text-muted-foreground" /><p className="font-semibold">No bookings yet.</p><Link href="/browse" className="mt-4 inline-flex items-center gap-2 text-xs font-bold text-primary">Browse equipment <ArrowRight size={14} /></Link></div> : bookings.map((booking) => <article key={booking.id} className="border border-border bg-card p-5"><div className="flex flex-col justify-between gap-5 md:flex-row md:items-start"><div><div className="mono-font text-[10px] text-primary">{booking.id} · {booking.createdAt.slice(0, 10)}</div><h2 className="mt-2 text-lg font-bold">{booking.equipmentName}</h2><div className="mt-2 flex flex-wrap gap-4 text-xs text-muted-foreground"><span className="flex items-center gap-1"><MapPin size={13} />{booking.location}</span><span className="flex items-center gap-1"><CalendarDays size={13} />24 Sep — 30 Sep 2026</span></div></div><div className="flex flex-wrap gap-2 text-[10px] font-bold uppercase"><span className="border border-emerald-400/30 bg-emerald-400/10 px-2 py-1 text-emerald-400">Payment {booking.paymentStatus}</span><span className="border border-primary/30 bg-primary/10 px-2 py-1 text-primary">{booking.status.replace('-', ' ')}</span></div></div><div className="mt-5 grid gap-3 border-t border-border pt-4 sm:grid-cols-4"><div><div className="text-[10px] text-muted-foreground">Total</div><div className="mt-1 font-bold text-primary">₹{fmt(booking.total)}</div></div><div><div className="text-[10px] text-muted-foreground">Next update</div><div className="mt-1 font-semibold">Owner confirmation</div></div><div><div className="text-[10px] text-muted-foreground">Location feed</div><div className="mt-1 font-semibold text-emerald-400">Ready</div></div><Link href="/notifications" className="flex items-center gap-2 text-xs font-bold text-primary sm:justify-end">VIEW STATUS <ArrowRight size={13} /></Link></div></article>)}</div></div></PageFrame>;
}

function NotificationsPage() {
  const { notifications, markNotificationsRead } = useAppState();
  useEffect(() => { markNotificationsRead(); }, [markNotificationsRead]);
  return <PageFrame><div className="px-5 py-12 lg:px-9 lg:py-20"><div className="flex items-end justify-between gap-5"><SectionLabel eyebrow="Operations feed / 03" title="Notifications." body="Booking states, payment events, vehicle location, and ECU operation signals arrive in one timeline." /><button onClick={markNotificationsRead} className="mb-7 hidden items-center gap-2 border border-border px-3 py-2 text-xs font-bold hover:border-primary sm:flex"><Check size={14} /> MARK ALL READ</button></div><div className="grid gap-3">{notifications.map((notification) => <article key={notification.id} className={`flex gap-4 border border-border bg-card p-5 ${!notification.read ? 'border-l-2 border-l-primary' : ''}`}><div className={`grid h-10 w-10 shrink-0 place-items-center ${notification.kind === 'payment' ? 'bg-emerald-400/15 text-emerald-400' : notification.kind === 'location' ? 'bg-sky-400/15 text-sky-300' : 'bg-primary/15 text-primary'}`}>{notification.kind === 'location' ? <MapPin size={18} /> : notification.kind === 'payment' ? <CreditCard size={18} /> : notification.kind === 'operation' ? <Gauge size={18} /> : <Bell size={18} />}</div><div className="min-w-0"><div className="flex flex-wrap items-center gap-3"><h2 className="text-sm font-bold">{notification.title}</h2><span className="text-[10px] text-muted-foreground">{notification.time}</span></div><p className="mt-1 text-sm leading-6 text-muted-foreground">{notification.body}</p></div></article>)}</div></div></PageFrame>;
}

function FleetPage() {
  const { equipment, sensors, setSensors, addNotification } = useAppState();
  const [selectedId, setSelectedId] = useState('cat-320');
  const selected = equipment.find((item) => item.id === selectedId) ?? equipment[0];
  const sensor = sensors[selected.id] ?? { temperature: 74.2, mileage: 0, workHours: 0, kmDriven: 0, fuel: 70, engineStatus: 'Idle' as const, lastSync: 'not synced' };
  useEffect(() => { const timer = window.setInterval(() => { setSensors({ ...sensors, [selected.id]: { ...sensor, temperature: Number((sensor.temperature + .1).toFixed(1)), workHours: Number((sensor.workHours + .01).toFixed(2)), lastSync: 'just now' } }); }, 5000); return () => window.clearInterval(timer); }, [selected.id, sensor.temperature, sensor.workHours, sensors, setSensors]);
  const toggleEngine = () => { const next = sensor.engineStatus === 'Running' ? 'Stopped' : 'Running'; setSensors({ ...sensors, [selected.id]: { ...sensor, engineStatus: next, lastSync: 'just now' } }); addNotification({ title: `Engine ${next.toLowerCase()}`, body: `${selected.name} operation status changed in the ECU feed.`, kind: 'operation', read: false }); };
  const isDump = selected.type === 'Dump truck';
  return <PageFrame><div className="px-5 py-12 lg:px-9 lg:py-20"><div className="flex flex-col justify-between gap-5 md:flex-row md:items-end"><SectionLabel eyebrow="ECU fleet / 04" title="Know the machine." body="This live-preview surface is ready for an ECU gateway: temperature, mileage, work hours, fuel, and driven distance are split by machine type." /><div className="flex items-center gap-2 border border-emerald-400/30 bg-emerald-400/10 px-3 py-2 text-[10px] font-bold text-emerald-400"><Radio size={14} /> ECU BRIDGE ONLINE</div></div><div className="mt-8 grid gap-8 lg:grid-cols-[.75fr_1.25fr]"><aside className="border border-border bg-card p-4"><div className="mono-font text-[10px] uppercase tracking-wider text-primary">Connected assets</div><div className="mt-4 grid gap-2">{equipment.slice(0, 4).map((item) => <button key={item.id} onClick={() => setSelectedId(item.id)} className={`flex items-center gap-3 border p-3 text-left ${selected.id === item.id ? 'border-primary bg-primary/10' : 'border-border hover:border-primary/60'}`}><div className="grid h-9 w-9 place-items-center bg-background text-primary"><Truck size={16} /></div><div className="min-w-0"><div className="truncate text-xs font-bold">{item.name}</div><div className="mt-1 text-[10px] text-muted-foreground">{item.type} · {item.city}</div></div><span className={`ml-auto h-2 w-2 rounded-full ${sensor.engineStatus === 'Running' && selected.id === item.id ? 'bg-emerald-400' : 'bg-primary'}`} /></button>)}</div></aside><div><div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">{[['Engine temperature', `${sensor.temperature} °C`, Activity], [isDump ? 'KM driven' : 'Mileage', `${isDump ? sensor.kmDriven : sensor.mileage} ${isDump ? 'km' : 'km'}`, Gauge], ['Work hours', `${sensor.workHours} h`, Clock3], ['Fuel level', `${sensor.fuel}%`, Zap]].map(([label, value, Icon]) => <div key={label as string} className="border border-border bg-card p-4"><div className="flex items-center gap-2 text-[10px] uppercase tracking-wider text-muted-foreground">{typeof Icon === 'function' ? <Icon size={14} /> : null}{label as string}</div><div className="mono-font mt-4 text-2xl font-bold text-primary">{value as string}</div></div>)}</div><div className="mt-4 grid gap-4 lg:grid-cols-[1.2fr_.8fr]"><div className="relative min-h-[320px] overflow-hidden border border-border map-grid"><svg className="absolute inset-0 h-full w-full opacity-50" viewBox="0 0 800 330" preserveAspectRatio="none"><path d="M-10 280 C 120 190, 180 250, 270 170 S 420 80, 520 150 S 680 240, 820 70" fill="none" stroke="#e8b632" strokeWidth="3" strokeDasharray="8 9" /></svg><div className="absolute left-[40%] top-[42%]"><div className="pin grid h-10 w-10 place-items-center rounded-full bg-primary text-primary-foreground"><Truck size={17} /></div><div className="mt-2 border border-border bg-background/90 px-3 py-2 text-[10px] shadow-lg"><b className="block">{selected.name}</b><span className="text-emerald-400">{sensor.engineStatus} · {sensor.lastSync}</span></div></div><div className="absolute bottom-4 left-4 border border-border bg-background/85 px-3 py-2 text-[10px] text-muted-foreground">Sample route layer · ready for GPS coordinates</div></div><div className="border border-border bg-card p-5"><div className="flex items-start justify-between border-b border-border pb-4"><div><div className="mono-font text-[10px] text-primary">Selected asset</div><h3 className="mt-2 text-lg font-bold">{selected.name}</h3><div className="mt-1 text-xs text-muted-foreground">{selected.owner} · {selected.city}</div></div><span className="border border-emerald-400/30 bg-emerald-400/10 px-2 py-1 text-[10px] font-bold text-emerald-400">{sensor.engineStatus}</span></div><div className="mt-5 grid gap-3 text-xs"><div className="flex justify-between"><span className="text-muted-foreground">Machine type</span><b>{selected.type}</b></div><div className="flex justify-between"><span className="text-muted-foreground">Feed status</span><b className="text-emerald-400">Connected</b></div><div className="flex justify-between"><span className="text-muted-foreground">Temperature range</span><b>65–95 °C</b></div></div><button onClick={toggleEngine} className="mt-6 flex h-11 w-full items-center justify-center gap-2 border border-primary text-xs font-bold text-primary hover:bg-primary hover:text-primary-foreground">{sensor.engineStatus === 'Running' ? 'STOP ENGINE PREVIEW' : 'START ENGINE PREVIEW'} <Zap size={14} /></button><div className="mt-4 border-l-2 border-primary bg-primary/5 p-3 text-[11px] leading-5 text-muted-foreground">Telemetry is currently simulated in the browser. The ECU adapter can replace this feed without changing the fleet UI contract.</div></div></div></div></div></div></PageFrame>;
}

function OwnerShell({ children, title }: { children: ReactNode; title: string }) {
  return <PageFrame><div className="grid lg:grid-cols-[240px_1fr]"><aside className="border-b border-border bg-card p-5 lg:min-h-[calc(100dvh-72px)] lg:border-b-0 lg:border-r lg:p-6"><div className="mono-font text-[10px] uppercase tracking-wider text-primary">Owner workspace</div><h2 className="display-font mt-2 text-3xl font-bold uppercase">{title}</h2><nav className="mt-7 grid gap-1">{[['/owner/dashboard', 'Dashboard', LayoutDashboard], ['/owner/listings', 'My listings', ClipboardList], ['/owner/listings/new', 'Add equipment', PackagePlus], ['/fleet', 'Fleet telemetry', Gauge]].map(([href, label, Icon]) => <Link key={href as string} href={href as string} className="flex items-center gap-3 px-3 py-3 text-xs font-semibold text-muted-foreground hover:bg-primary/10 hover:text-primary">{typeof Icon === 'function' ? <Icon size={15} /> : null}{label as string}</Link>)}</nav></aside><section className="min-w-0 px-5 py-10 lg:px-10 lg:py-14">{children}</section></div></PageFrame>;
}

function OwnerDashboardPage() {
  const { equipment, bookings } = useAppState();
  return <OwnerShell title="Owner console"><SectionLabel eyebrow="Operations / 01" title="One board. Every moving part." body="Manage listings, bookings, revenue, and ECU-connected assets from the owner workspace." /><div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">{[['08', 'Active listings', ClipboardList], [String(bookings.length), 'Confirmed bookings', CalendarDays], ['03', 'ECU connected', Radio], ['₹64,837', 'Gross booked', WalletCards]].map(([value, label, Icon]) => <div key={label as string} className="border border-border bg-card p-5"><div className="flex items-center justify-between"><span className="mono-font text-2xl font-bold text-primary">{value as string}</span>{typeof Icon === 'function' ? <Icon size={17} className="text-primary" /> : null}</div><div className="mt-2 text-xs text-muted-foreground">{label as string}</div></div>)}</div><div className="mt-8 border border-border bg-card p-5"><div className="flex items-center justify-between"><h3 className="text-sm font-bold">Current work orders</h3><Link href="/owner/listings" className="text-xs font-bold text-primary">View listings <ArrowRight className="inline" size={12} /></Link></div><div className="mt-4 overflow-x-auto"><table className="w-full min-w-[620px] text-left text-xs"><thead className="border-y border-border text-[10px] uppercase tracking-wider text-muted-foreground"><tr><th className="py-3">Equipment</th><th className="py-3">Site</th><th className="py-3">State</th><th className="py-3 text-right">Value</th></tr></thead><tbody>{(bookings.length ? bookings : [{ equipmentName: equipment[0].name, location: 'Whitefield', status: 'on-site', total: 27000 } as Booking]).map((booking) => <tr key={booking.equipmentName} className="border-b border-border last:border-0"><td className="py-4 font-semibold">{booking.equipmentName}</td><td className="py-4 text-muted-foreground">{booking.location}</td><td className="py-4"><span className="rounded-full bg-emerald-400/15 px-2 py-1 text-[10px] text-emerald-400">{booking.status.replace('-', ' ')}</span></td><td className="py-4 text-right font-bold">₹{fmt(booking.total)}</td></tr>)}</tbody></table></div></div></OwnerShell>;
}

function OwnerListingsPage() {
  const { equipment } = useAppState();
  return <OwnerShell title="My listings"><div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end"><SectionLabel eyebrow="Inventory / 02" title="Your machines." body="Add equipment, set a rate, and expose availability to the marketplace." /><Link href="/owner/listings/new" className="mb-7 flex h-11 items-center gap-2 bg-primary px-4 text-xs font-bold text-primary-foreground"><PackagePlus size={15} /> ADD EQUIPMENT</Link></div><div className="grid gap-4">{equipment.map((item) => <article key={item.id} className="flex flex-col gap-4 border border-border bg-card p-4 sm:flex-row sm:items-center"><div className="h-28 w-full shrink-0 sm:w-44"><EquipmentIllustration kind={item.image} initials={item.type.slice(0, 3).toUpperCase()} /></div><div className="min-w-0 flex-1"><div className="mono-font text-[9px] uppercase tracking-wider text-primary">{item.type}</div><h2 className="mt-1 text-lg font-bold">{item.name}</h2><div className="mt-2 flex flex-wrap gap-3 text-xs text-muted-foreground"><span className="flex items-center gap-1"><MapPin size={13} />{item.city}</span><span className="flex items-center gap-1"><WalletCards size={13} />₹{fmt(item.price)} / day</span><span className="flex items-center gap-1"><Wrench size={13} />{item.operatorIncluded ? 'Operator available' : 'Machine only'}</span></div></div><div className="flex items-center gap-2 text-xs"><span className="h-2 w-2 rounded-full bg-emerald-400" />{item.available}</div></article>)}</div></OwnerShell>;
}

function NewListingPage() {
  const { addEquipment, addNotification } = useAppState();
  const [, setLocation] = useLocation();
  const [form, setForm] = useState({ name: '', type: 'Excavator', city: 'Bengaluru', price: '4500', operatorIncluded: true });
  const submit = (event: FormEvent) => { event.preventDefault(); const id = form.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || `machine-${Date.now()}`; addEquipment({ id, name: form.name, type: form.type, city: form.city, price: Number(form.price), rating: 'New', reviews: 0, image: form.type === 'Dump truck' ? 'dump' : form.type === 'Crane' ? 'crane' : form.type === 'Loader' ? 'loader' : form.type === 'Generator' ? 'generator' : 'excavator', tag: 'New listing', available: 'Today', owner: 'Your company', operatorIncluded: form.operatorIncluded }); addNotification({ title: 'New equipment listed', body: `${form.name} is now visible in the marketplace preview.`, kind: 'system', read: false }); setLocation('/owner/listings'); };
  return <OwnerShell title="Add equipment"><SectionLabel eyebrow="Inventory / 03" title="Put a machine to work." body="Create a marketplace listing for your equipment owner account." /><form onSubmit={submit} className="max-w-2xl border border-border bg-card p-6"><div className="grid gap-4 sm:grid-cols-2"><label className="sm:col-span-2"><span className="mono-font mb-1.5 block text-[9px] uppercase tracking-wider text-muted-foreground">Equipment name *</span><input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="h-11 w-full border border-input bg-background px-3 text-sm" placeholder="e.g. Tata Hitachi ZX210" /></label><label><span className="mono-font mb-1.5 block text-[9px] uppercase tracking-wider text-muted-foreground">Machine type</span><select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })} className="h-11 w-full border border-input bg-background px-3 text-sm"><option>Excavator</option><option>Dump truck</option><option>Crane</option><option>Loader</option><option>Generator</option></select></label><label><span className="mono-font mb-1.5 block text-[9px] uppercase tracking-wider text-muted-foreground">City</span><input required value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} className="h-11 w-full border border-input bg-background px-3 text-sm" /></label><label><span className="mono-font mb-1.5 block text-[9px] uppercase tracking-wider text-muted-foreground">Daily rate (₹) *</span><input required type="number" min="1" value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} className="h-11 w-full border border-input bg-background px-3 text-sm" /></label><label className="flex items-center gap-3 self-end pb-3 text-xs font-semibold"><input type="checkbox" checked={form.operatorIncluded} onChange={(e) => setForm({ ...form, operatorIncluded: e.target.checked })} className="h-4 w-4 accent-[hsl(var(--primary))]" /> Operator available</label></div><div className="mt-6 flex items-center gap-3 border-l-2 border-primary bg-primary/5 p-4 text-xs leading-5 text-muted-foreground"><Radio size={16} className="shrink-0 text-primary" />You can connect ECU telemetry after listing to expose temperature, mileage, work hours, and operation status.</div><button className="mt-6 flex h-11 w-full items-center justify-center gap-2 bg-primary text-xs font-bold text-primary-foreground"><PackagePlus size={15} /> PUBLISH LISTING</button></form></OwnerShell>;
}

function AdminShell({ children }: { children: ReactNode }) {
  return <PageFrame><div className="grid lg:grid-cols-[240px_1fr]"><aside className="border-b border-border bg-card p-5 lg:min-h-[calc(100dvh-72px)] lg:border-b-0 lg:border-r lg:p-6"><div className="mono-font text-[10px] uppercase tracking-wider text-primary">Admin console</div><h2 className="display-font mt-2 text-3xl font-bold uppercase">Control room</h2><nav className="mt-7 grid gap-1">{[['/admin', 'Overview', LayoutDashboard], ['/admin/users', 'Users', Users], ['/admin/bookings', 'Bookings', ReceiptText], ['/admin/sensors', 'ECU sensors', Gauge], ['/admin/notifications', 'Notifications', Bell]].map(([href, label, Icon]) => <Link key={href as string} href={href as string} className="flex items-center gap-3 px-3 py-3 text-xs font-semibold text-muted-foreground hover:bg-primary/10 hover:text-primary">{typeof Icon === 'function' ? <Icon size={15} /> : null}{label as string}</Link>)}</nav></aside><section className="min-w-0 px-5 py-10 lg:px-10 lg:py-14">{children}</section></div></PageFrame>;
}

function AdminOverviewPage() {
  const { equipment, bookings, notifications } = useAppState();
  return <AdminShell><SectionLabel eyebrow="Admin / overview" title="Marketplace control room." body="A separate operational view for users, bookings, ECU feeds, and notification health." /><div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">{[['1,284', 'Users', Users], [String(bookings.length + 33), 'Total bookings', ReceiptText], [String(equipment.length), 'Active assets', Truck], [String(notifications.length), 'Notification events', Bell]].map(([value, label, Icon]) => <div key={label as string} className="border border-border bg-card p-5"><div className="flex items-center justify-between"><span className="mono-font text-2xl font-bold text-primary">{value as string}</span>{typeof Icon === 'function' ? <Icon size={17} className="text-primary" /> : null}</div><div className="mt-2 text-xs text-muted-foreground">{label as string}</div></div>)}</div><div className="mt-8 grid gap-4 lg:grid-cols-2"><div className="border border-border bg-card p-5"><h3 className="text-sm font-bold">Service health</h3><div className="mt-4 grid gap-3">{[['Clerk auth', 'Operational'], ['Booking state engine', 'Operational'], ['ECU bridge', 'Preview connected'], ['Notification dispatcher', 'Operational']].map(([label, state]) => <div key={label} className="flex items-center justify-between border-b border-border pb-3 text-xs last:border-0 last:pb-0"><span>{label}</span><span className="flex items-center gap-2 text-emerald-400"><span className="h-2 w-2 rounded-full bg-emerald-400" />{state}</span></div>)}</div></div><div className="border border-border bg-card p-5"><h3 className="text-sm font-bold">Recent activity</h3><div className="mt-4 grid gap-3">{notifications.slice(0, 4).map((item) => <div key={item.id} className="flex gap-3 border-b border-border pb-3 text-xs last:border-0 last:pb-0"><Activity size={14} className="mt-0.5 text-primary" /><div><b>{item.title}</b><div className="mt-1 text-muted-foreground">{item.time}</div></div></div>)}</div></div></div></AdminShell>;
}

function AdminUsersPage() {
  return <AdminShell><SectionLabel eyebrow="Admin / users" title="Users and roles." body="Separate customer, equipment owner, operator, and administrator access surfaces." /><div className="overflow-x-auto border border-border bg-card"><table className="w-full min-w-[640px] text-left text-xs"><thead className="border-b border-border text-[10px] uppercase tracking-wider text-muted-foreground"><tr><th className="p-4">User</th><th className="p-4">Role</th><th className="p-4">Status</th><th className="p-4">Last active</th></tr></thead><tbody>{[['Ananya Rao', 'Customer', 'Verified', '2 min ago'], ['Kumar Earthmovers', 'Owner', 'Verified', '12 min ago'], ['Ravi Operator', 'Operator', 'On shift', '18 min ago'], ['Admin workspace', 'Admin', 'Protected', 'Now']].map(([name, role, status, last]) => <tr key={name} className="border-b border-border last:border-0"><td className="p-4 font-semibold">{name}</td><td className="p-4 text-muted-foreground">{role}</td><td className="p-4 text-emerald-400">{status}</td><td className="p-4 text-muted-foreground">{last}</td></tr>)}</tbody></table></div></AdminShell>;
}

function AdminBookingsPage() {
  const { bookings } = useAppState();
  return <AdminShell><SectionLabel eyebrow="Admin / bookings" title="Booking states." body="Payment confirmation and booking confirmation remain separate operational events." /><div className="grid gap-3">{(bookings.length ? bookings : [{ id: 'RB-DEMO-01', equipmentName: 'CAT 320 Excavator', location: 'Whitefield', paymentStatus: 'paid', status: 'confirmed', total: 27000 } as Booking]).map((booking) => <div key={booking.id} className="flex flex-col justify-between gap-4 border border-border bg-card p-5 sm:flex-row sm:items-center"><div><div className="mono-font text-[10px] text-primary">{booking.id}</div><h3 className="mt-2 font-bold">{booking.equipmentName}</h3><div className="mt-1 text-xs text-muted-foreground">{booking.location}</div></div><div className="flex flex-wrap gap-2 text-[10px] font-bold uppercase"><span className="border border-emerald-400/30 bg-emerald-400/10 px-2 py-1 text-emerald-400">Payment {booking.paymentStatus}</span><span className="border border-primary/30 bg-primary/10 px-2 py-1 text-primary">{booking.status.replace('-', ' ')}</span><span className="px-2 py-1 text-primary">₹{fmt(booking.total)}</span></div></div>)}</div></AdminShell>;
}

function AdminSensorsPage() {
  const { equipment, sensors } = useAppState();
  return <AdminShell><SectionLabel eyebrow="Admin / sensors" title="ECU feed health." body="All machine telemetry is visible here: GPS, engine, fuel, electrical, fluid, odometer, and work-session readings." /><div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{equipment.slice(0, 4).map((item) => { const sensor = sensors[item.id] ?? defaultSensors['cat-320']; const readings = [['GPS latitude', `${sensor.latitude.toFixed(5)}°`], ['GPS longitude', `${sensor.longitude.toFixed(5)}°`], ['Speed', `${sensor.speedKph} km/h`], ['Odometer', `${sensor.odometerKm.toLocaleString('en-IN')} km`], ['Engine temperature', `${sensor.temperature} °C`], ['Engine RPM', `${sensor.engineRpm}`], ['Engine load', `${sensor.engineLoad}%`], ['Work hours', `${sensor.workHours} h`], ['Fuel level', `${sensor.fuel}%`], ['Fuel rate', `${sensor.fuelRate} L/h`], ['Battery voltage', `${sensor.batteryVoltage} V`], ['Oil pressure', `${sensor.oilPressure} bar`], ['Coolant level', `${sensor.coolantLevel}%`], ['Distance today', `${sensor.kmDriven} km`], ['Engine state', sensor.engineStatus], ['Last ECU sync', sensor.lastSync]]; return <article key={item.id} className="border border-border bg-card p-5"><div className="flex items-start justify-between"><div><div className="mono-font text-[10px] text-primary">{item.type} · {item.city}</div><h3 className="mt-2 font-bold">{item.name}</h3><div className="mt-1 text-[10px] text-muted-foreground">Vehicle {item.id.toUpperCase()} · ECU connected</div></div><span className="flex items-center gap-2 text-[10px] text-emerald-400"><span className="h-2 w-2 animate-pulse rounded-full bg-emerald-400" />Live</span></div><div className="mt-5 grid grid-cols-2 gap-2 text-xs">{readings.map(([label, value]) => <div key={label} className="border border-border p-3"><div className="text-[10px] text-muted-foreground">{label}</div><div className="mono-font mt-2 font-bold text-primary">{value}</div></div>)}</div></article>; })}</div></AdminShell>;
}

function AdminNotificationsPage() {
  const { notifications } = useAppState();
  return <AdminShell><SectionLabel eyebrow="Admin / notifications" title="Dispatcher log." body="A central feed for booking, payment, location, and operation events." /><div className="border border-border bg-card">{notifications.map((item) => <div key={item.id} className="flex gap-4 border-b border-border p-5 last:border-0"><Bell size={15} className="mt-1 text-primary" /><div><div className="text-sm font-bold">{item.title}</div><div className="mt-1 text-xs text-muted-foreground">{item.body}</div></div><span className="ml-auto text-[10px] text-muted-foreground">{item.time}</span></div>)}</div></AdminShell>;
}

function SignOutButton() {
  const { signOut } = useClerk();
  return <button onClick={() => signOut({ redirectUrl: basePath || '/' })} className="flex items-center gap-2 text-xs font-bold text-muted-foreground hover:text-primary"><LogOut size={14} /> Sign out</button>;
}

function ProfileMenuPage() {
  return <PageFrame><div className="px-5 py-12 lg:px-9 lg:py-20"><div className="max-w-3xl"><SectionLabel eyebrow="Account / 02" title="Workspace links." body="Move between the customer, owner, and admin surfaces without losing the shared booking and notification state." /><div className="grid gap-3 sm:grid-cols-2">{[['Customer details', '/profile', UserRound], ['My bookings', '/bookings', CalendarDays], ['Saved equipment', '/favorites', Heart], ['Owner workspace', '/owner/dashboard', LayoutDashboard], ['Admin login', '/admin/login', ShieldCheck], ['Sign out', '#sign-out', LogOut]].map(([label, href, Icon]) => href === '#sign-out' ? <button key={label as string} onClick={() => document.getElementById('sign-out')?.click()} className="flex items-center justify-between border border-border bg-card p-5 text-left hover:border-primary"><span className="flex items-center gap-3 text-sm font-bold">{typeof Icon === 'function' ? <Icon size={17} className="text-primary" /> : null}{label as string}</span><ArrowRight size={15} /></button> : <Link key={label as string} href={href as string} className="flex items-center justify-between border border-border bg-card p-5 hover:border-primary"><span className="flex items-center gap-3 text-sm font-bold">{typeof Icon === 'function' ? <Icon size={17} className="text-primary" /> : null}{label as string}</span><ArrowRight size={15} /></Link>)}</div><div id="sign-out" className="mt-8 border-t border-border pt-5"><SignOutButton /></div></div></div></PageFrame>;
}

function FavoritesPage() {
  const { equipment, favorites } = useAppState();
  const saved = equipment.filter((item) => favorites.includes(item.id));
  return <PageFrame><div className="px-5 py-12 lg:px-9 lg:py-20"><SectionLabel eyebrow="Customer portal / 04" title="Saved equipment." body="Keep a shortlist while you compare rates and locations." /><div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-4">{saved.length ? saved.map((item) => <EquipmentCard key={item.id} item={item} />) : <div className="border border-dashed border-border p-12 text-center sm:col-span-2 xl:col-span-4"><Heart className="mx-auto mb-3 text-muted-foreground" /><p className="font-semibold">No saved machines yet.</p><Link href="/browse" className="mt-4 inline-flex items-center gap-2 text-xs font-bold text-primary">Browse the yard <ArrowRight size={14} /></Link></div>}</div></div></PageFrame>;
}

function Router() {
  return <Switch><Route path="/" component={HomePage} /><Route path="/sign-in/*?" component={() => <AuthPage mode="sign-in" />} /><Route path="/sign-up/*?" component={() => <AuthPage mode="sign-up" />} /><Route path="/admin/login" component={AdminLoginPage} /><Route path="/browse" component={BrowsePage} /><Route path="/how-it-works" component={HowItWorksPage} /><Route path="/booking/:id" component={() => <ProtectedPage><BookingPage /></ProtectedPage>} /><Route path="/bookings" component={() => <ProtectedPage><BookingsPage /></ProtectedPage>} /><Route path="/notifications" component={() => <ProtectedPage><NotificationsPage /></ProtectedPage>} /><Route path="/profile" component={() => <ProtectedPage><ProfilePage /></ProtectedPage>} /><Route path="/favorites" component={() => <ProtectedPage><FavoritesPage /></ProtectedPage>} /><Route path="/fleet" component={() => <ProtectedPage><FleetPage /></ProtectedPage>} /><Route path="/owner/dashboard" component={() => <ProtectedPage><OwnerDashboardPage /></ProtectedPage>} /><Route path="/owner/listings" component={() => <ProtectedPage><OwnerListingsPage /></ProtectedPage>} /><Route path="/owner/listings/new" component={() => <ProtectedPage><NewListingPage /></ProtectedPage>} /><Route path="/admin" component={() => <ProtectedPage><AdminOverviewPage /></ProtectedPage>} /><Route path="/admin/users" component={() => <ProtectedPage><AdminUsersPage /></ProtectedPage>} /><Route path="/admin/bookings" component={() => <ProtectedPage><AdminBookingsPage /></ProtectedPage>} /><Route path="/admin/sensors" component={() => <ProtectedPage><AdminSensorsPage /></ProtectedPage>} /><Route path="/admin/notifications" component={() => <ProtectedPage><AdminNotificationsPage /></ProtectedPage>} /><Route component={NotFound} /></Switch>;
}

const clerkAppearance = {
  theme: shadcn,
  cssLayerName: 'clerk',
  options: {
    logoPlacement: 'inside' as const,
    logoLinkUrl: basePath || '/',
    logoImageUrl: `${window.location.origin}${basePath}/logo.svg`,
  },
  variables: {
    colorPrimary: '#f3b62d',
    colorForeground: '#f7f2e8',
    colorMutedForeground: '#9ba5b7',
    colorDanger: '#ef6b61',
    colorBackground: '#171c28',
    colorInput: '#10151f',
    colorInputForeground: '#f7f2e8',
    colorNeutral: '#344052',
    fontFamily: 'DM Sans',
    borderRadius: '0px',
  },
  elements: {
    rootBox: 'w-full flex justify-center',
    cardBox: 'bg-[#171c28] border border-[#344052] rounded-none w-[440px] max-w-full overflow-hidden',
    card: '!shadow-none !border-0 !bg-transparent !rounded-none',
    footer: '!shadow-none !border-0 !bg-transparent !rounded-none',
    headerTitle: 'text-[#f7f2e8] font-bold',
    headerSubtitle: 'text-[#9ba5b7]',
    socialButtonsBlockButtonText: 'text-[#f7f2e8]',
    formFieldLabel: 'text-[#f7f2e8]',
    footerActionLink: 'text-[#f3b62d]',
    footerActionText: 'text-[#9ba5b7]',
    dividerText: 'text-[#9ba5b7]',
    alertText: 'text-[#f7f2e8]',
    formButtonPrimary: 'bg-[#f3b62d] text-[#10151f] hover:bg-[#ffd15e]',
    formFieldInput: 'bg-[#10151f] border-[#344052] text-[#f7f2e8]',
    socialButtonsBlockButton: 'bg-[#10151f] border-[#344052]',
    dividerLine: 'bg-[#344052]',
    logoBox: 'h-10',
    logoImage: 'max-h-10',
    main: 'bg-transparent',
  },
};

function ClerkProviderWithRoutes() {
  const [, setLocation] = useLocation();
  const stripBase = (path: string) => basePath && path.startsWith(basePath) ? path.slice(basePath.length) || '/' : path;
  return <ClerkProvider publishableKey={clerkPubKey || 'pk_test_placeholder'} proxyUrl={clerkProxyUrl} appearance={clerkAppearance} signInUrl={`${basePath}/sign-in`} signUpUrl={`${basePath}/sign-up`} localization={{ signIn: { start: { title: 'Welcome back', subtitle: 'Sign in to access your account' } }, signUp: { start: { title: 'Create your account', subtitle: 'Start booking with confidence' } } }} routerPush={(to) => setLocation(stripBase(to))} routerReplace={(to) => setLocation(stripBase(to))}><AppStateProvider><Router /></AppStateProvider></ClerkProvider>;
}

function App() {
  return <WouterRouter base={basePath}><ClerkProviderWithRoutes /></WouterRouter>;
}

export default App;