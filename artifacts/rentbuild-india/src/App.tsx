import {
  type FormEvent,
  type Dispatch,
  type ReactNode,
  type SetStateAction,
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
const localDemoMode = !import.meta.env.VITE_CLERK_PUBLISHABLE_KEY;

// The marketplace remains browsable without Clerk; protected actions show the sign-in route.
// Configure VITE_CLERK_PUBLISHABLE_KEY in production to enable managed authentication.

type Equipment = {
  id: string;
  name: string;
  type: string;
  vehicleNumber: string;
  rcCardNumber: string;
  city: string;
  rating: string;
  reviews: number;
  price: number;
  image: 'excavator' | 'dump' | 'crane' | 'loader' | 'generator';
  tag: string;
  available: string;
  owner: string;
  ownerEmail?: string;
  ownerPhone: string;
  operatorName: string;
  operatorPhone: string;
  operatorExperience: string;
  workingHours: number;
  kmDriven: number;
  sensorsWorking: boolean;
  operatorIncluded: boolean;
};

type WorkspaceUser = {
  fullName: string;
  primaryEmailAddress: { emailAddress: string };
  role: 'customer' | 'owner' | 'operator' | 'admin';
};

type LocalAccount = WorkspaceUser & { password: string };

const LocalAuthContext = createContext<{
  isLoaded: boolean;
  isSignedIn: boolean;
  user: WorkspaceUser | null;
  accounts: LocalAccount[];
  register: (user: WorkspaceUser, password?: string) => void;
  login: (userId: string, password: string) => WorkspaceUser | null;
  signOut: () => void;
} | null>(null);

function useWorkspaceAuth() {
  const local = useContext(LocalAuthContext);
  if (local) return local;
  return useAuth();
}

function useWorkspaceUser() {
  const local = useContext(LocalAuthContext);
  if (local) return { user: local.user };
  const clerk = useUser();
  const clerkRole = clerk.user?.publicMetadata?.role;
  return {
    user: clerk.user
      ? {
          fullName: clerk.user.fullName ?? 'Workspace user',
          primaryEmailAddress: { emailAddress: clerk.user.primaryEmailAddress?.emailAddress ?? '' },
          role: (clerkRole === 'admin' || clerkRole === 'owner' || clerkRole === 'operator' ? clerkRole : 'customer') as WorkspaceUser['role'],
        }
      : null,
  };
}

function useWorkspaceClerk() {
  const local = useContext(LocalAuthContext);
  if (local) return { signOut: () => local.signOut() };
  const clerk = useClerk();
  return { signOut: (options?: { redirectUrl?: string }) => clerk.signOut(options) };
}

function LocalAuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useStoredState<WorkspaceUser | null>('rb-local-user', null);
  const [accounts, setAccounts] = useStoredState<LocalAccount[]>('rb-local-accounts', [
    {
      fullName: 'RentBuild Administrator',
      primaryEmailAddress: { emailAddress: 'admin@rentbuild.in' },
      role: 'admin',
      password: 'Admin2026',
    },
  ]);
  useEffect(() => {
    if (!accounts.some((account) => account.primaryEmailAddress.emailAddress.toLowerCase() === 'admin@rentbuild.in')) {
      setAccounts((current) => [...current, {
        fullName: 'RentBuild Administrator',
        primaryEmailAddress: { emailAddress: 'admin@rentbuild.in' },
        role: 'admin',
        password: 'Admin2026',
      }]);
    }
  }, [accounts, setAccounts]);
  const value = {
    isLoaded: true,
    isSignedIn: Boolean(user),
    user,
    accounts,
    register: (nextUser: WorkspaceUser, password = '') => {
      setAccounts((current) => {
        const withoutExisting = current.filter((account) => account.primaryEmailAddress.emailAddress.toLowerCase() !== nextUser.primaryEmailAddress.emailAddress.toLowerCase());
        return [...withoutExisting, { ...nextUser, password }];
      });
      setUser(nextUser);
    },
    login: (userId: string, password: string) => {
      const account = accounts.find((candidate) =>
        candidate.primaryEmailAddress.emailAddress.toLowerCase() === userId.trim().toLowerCase() &&
        candidate.password === password,
      );
      if (!account) return null;
      const { password: _password, ...authenticatedUser } = account;
      setUser(authenticatedUser);
      return authenticatedUser;
    },
    signOut: () => setUser(null),
  };
  return <LocalAuthContext.Provider value={value}>{children}</LocalAuthContext.Provider>;
}

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
  paymentStatus: 'paid' | 'pending' | 'refunded';
  status: 'payment-confirmed' | 'confirmed' | 'in-transit' | 'on-site' | 'completed' | 'cancelled';
  cancellationFee?: number;
  refundAmount?: number;
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
  hydraulicPressure: number;
  coolantLevel: number;
  fuelRate: number;
  engineStatus: 'Running' | 'Idle' | 'Stopped';
  lastSync: string;
};

const equipmentSeed: Equipment[] = [];
const defaultNotifications: AppNotification[] = [];
const defaultSensors: Record<string, SensorData> = {};
const defaultSensor: SensorData = {
  temperature: 74.2,
  mileage: 0,
  workHours: 0,
  kmDriven: 0,
  fuel: 70,
  odometerKm: 0,
  latitude: 0,
  longitude: 0,
  speedKph: 0,
  engineRpm: 0,
  engineLoad: 0,
  batteryVoltage: 24,
  oilPressure: 0,
  hydraulicPressure: 0,
  coolantLevel: 0,
  fuelRate: 0,
  engineStatus: 'Idle',
  lastSync: 'not synced',
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
  updateBooking: (id: string, update: Partial<Booking>) => void;
  notifications: AppNotification[];
  addNotification: (notification: Omit<AppNotification, 'id' | 'time'>) => void;
  markNotificationsRead: () => void;
  sensors: Record<string, SensorData>;
  setSensors: Dispatch<SetStateAction<Record<string, SensorData>>>;
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
  useEffect(() => {
    setEquipment((current) => current.filter((item) => !['cat-320', 'volvo-a40', 'liebherr', 'jcb-3dx', 'cummins-125'].includes(item.id)));
    setNotifications((current) => current.filter((item) => !['n1', 'n2', 'n3'].includes(item.id)));
    setSensors((current) => Object.fromEntries(Object.entries(current).filter(([id]) => !['cat-320', 'volvo-a40', 'liebherr'].includes(id))));
  }, [setEquipment, setNotifications, setSensors]);

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
        updateBooking: (id, update) =>
          setBookings((current) => current.map((booking) => booking.id === id ? { ...booking, ...update } : booking)),
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
  const { isSignedIn } = useWorkspaceAuth();
  const { user } = useWorkspaceUser();
  const unread = notifications.filter((item) => !item.read).length;
  const roleLabel = user?.role === 'admin' ? 'Admin console' : user?.role === 'owner' ? 'Owner workspace' : user?.role === 'operator' ? 'Operator portal' : 'Customer portal';
  return (
    <header className="sticky top-0 z-40 border-b border-border/80 bg-background/90 backdrop-blur-xl">
      <div className="mx-auto flex h-[72px] max-w-[1440px] items-center justify-between gap-5 px-5 lg:px-9">
        <Link href="/">
          <Logo />
        </Link>
        <nav className="hidden items-center gap-6 lg:flex" aria-label="Primary navigation">
          <Link href="/browse" className="text-xs font-semibold text-foreground/75 hover:text-primary">Browse equipment</Link>
          <Link href="/owner/listings" className="text-xs font-semibold text-foreground/75 hover:text-primary">List your equipment</Link>
          <Link href="/how-it-works" className="text-xs font-semibold text-foreground/75 hover:text-primary">How it works</Link>
          {isSignedIn && (user?.role === 'owner' || user?.role === 'admin') && <Link href="/fleet" className="text-xs font-semibold text-foreground/75 hover:text-primary">Fleet monitoring</Link>}
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
              <Link href={user?.role === 'admin' ? '/admin' : user?.role === 'owner' ? '/owner/dashboard' : '/profile'} className="hidden h-9 items-center gap-2 rounded-full border border-border px-3 text-xs font-semibold hover:border-primary sm:flex">
                <CircleUserRound size={15} className="text-primary" /> {roleLabel}
              </Link>
              <SignOutButton compact />
            </>
          )}
          {!isSignedIn && (
            <div className="hidden items-center gap-2 sm:flex">
              <Link href="/sign-in" className="flex h-9 items-center gap-2 border border-border px-3 text-xs font-bold hover:border-primary hover:text-primary"><LogIn size={14} /> Customer login</Link>
              <Link href="/sign-in?role=owner" className="flex h-9 items-center gap-2 border border-border px-3 text-xs font-bold hover:border-primary hover:text-primary"><Truck size={14} /> Owner login</Link>
              <Link href="/admin/login" className="flex h-9 items-center gap-2 border border-primary px-3 text-xs font-bold text-primary hover:bg-primary hover:text-primary-foreground"><ShieldCheck size={14} /> Admin login</Link>
            </div>
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
  const { isSignedIn } = useWorkspaceAuth();
  const { user } = useWorkspaceUser();
  const canMonitorFleet = user?.role === 'admin' || user?.role === 'owner';
  return (
    <div className="fixed inset-0 z-50 bg-background/98 p-5 backdrop-blur-xl lg:hidden">
      <div className="flex items-center justify-between"><Logo /><button onClick={close} className="grid h-10 w-10 place-items-center rounded-full border border-border" aria-label="Close navigation"><X size={18} /></button></div>
      <nav className="mt-12 grid gap-2" aria-label="Mobile navigation">
        {[
          ['/browse', 'Browse equipment'],
          ['/bookings', 'My bookings'],
          ['/owner/listings', 'Owner listings'],
          ['/notifications', 'Notifications'],
        ].map(([href, text]) => <Link key={href} onClick={close} href={href} className="border-b border-border py-4 text-2xl font-semibold">{text}</Link>)}
        {canMonitorFleet && <Link onClick={close} href="/fleet" className="border-b border-border py-4 text-2xl font-semibold">Fleet monitoring</Link>}
        {user?.role === 'admin' && <Link onClick={close} href="/admin" className="border-b border-border py-4 text-2xl font-semibold">Admin console</Link>}
        {isSignedIn ? <SignOutButton /> : <><Link onClick={close} href="/sign-in" className="flex items-center gap-3 border-b border-border py-4 text-2xl font-semibold"><LogIn size={22} /> Customer login</Link><Link onClick={close} href="/sign-in?role=owner" className="flex items-center gap-3 border-b border-border py-4 text-2xl font-semibold"><Truck size={22} /> Owner login</Link><Link onClick={close} href="/admin/login" className="flex items-center gap-3 border-b border-border py-4 text-2xl font-semibold"><ShieldCheck size={22} /> Admin login</Link></>}
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
      <div className="p-4"><div className="mono-font text-[9px] uppercase tracking-[.14em] text-primary">{item.type}</div><h3 className="mt-1 text-sm font-bold leading-5">{item.name}</h3><div className="mt-3 flex items-center gap-1.5 text-xs text-muted-foreground"><MapPin size={13} />{item.city}<span className="mx-1 text-border">/</span><span className="text-emerald-400">{item.available}</span></div><div className="mt-3 grid grid-cols-2 gap-2 border-y border-border py-3 text-[10px] text-muted-foreground"><span>Vehicle <b className="block text-foreground">{item.vehicleNumber || 'Not provided'}</b></span><span>RC card <b className="block text-foreground">{item.rcCardNumber || 'Not provided'}</b></span><span>Work hours <b className="block text-foreground">{item.workingHours || 0} h</b></span><span>KM driven <b className="block text-foreground">{item.kmDriven || 0} km</b></span></div><div className="mt-4 flex items-end justify-between"><div><span className="text-lg font-bold text-primary">₹{fmt(item.price)}</span><span className="text-[10px] text-muted-foreground"> / day</span><div className="mt-1 text-[10px] text-muted-foreground">Owner: {item.owner}</div></div><Link href={`/booking/${item.id}`} className="flex items-center gap-1.5 bg-primary px-3 py-2 text-[11px] font-bold text-primary-foreground hover:gap-2.5">BOOK <ArrowRight size={13} /></Link></div></div>
    </article>
  );
}

function BrowsePage() {
  const { equipment } = useAppState();
  const [query, setQuery] = useState('');
  const [city, setCity] = useState('All cities');
  const [type, setType] = useState('All equipment');
  const filtered = equipment.filter((item) => (type === 'All equipment' || item.type === type) && (city === 'All cities' || item.city === city) && `${item.name} ${item.city} ${item.owner}`.toLowerCase().includes(query.toLowerCase()));
  return <PageFrame><div className="px-5 py-12 lg:px-9 lg:py-20"><div className="flex flex-col justify-between gap-5 md:flex-row md:items-end"><div><SectionLabel eyebrow="Equipment directory / 02" title="Find the right machine." body="Filter the marketplace by machine, city, or owner, then continue into a protected booking flow." /><div className="flex items-center gap-2 text-xs text-emerald-400"><span className="h-2 w-2 rounded-full bg-emerald-400" />{filtered.length} matching listing{filtered.length === 1 ? '' : 's'}</div></div><Link href="/owner/listings/new" className="flex h-11 items-center gap-2 border border-primary px-4 text-xs font-bold text-primary hover:bg-primary hover:text-primary-foreground"><PackagePlus size={15} /> LIST A MACHINE</Link></div><div className="mt-7 grid gap-3 border border-border bg-card p-4 md:grid-cols-[1.2fr_.8fr_.8fr]"><label className="relative block"><span className="mono-font mb-1.5 block text-[9px] uppercase tracking-wider text-muted-foreground">Search listings</span><Wrench className="absolute left-3 top-9 text-muted-foreground" size={15} /><input value={query} onChange={(e) => setQuery(e.target.value)} className="h-11 w-full border border-input bg-background pl-9 pr-3 text-sm" placeholder="CAT, dump truck, owner..." /></label><label><span className="mono-font mb-1.5 block text-[9px] uppercase tracking-wider text-muted-foreground">Machine type</span><select value={type} onChange={(e) => setType(e.target.value)} className="h-11 w-full border border-input bg-background px-3 text-sm"><option>All equipment</option><option>Excavator</option><option>Dump truck</option><option>Crane</option><option>Loader</option><option>Generator</option></select></label><label><span className="mono-font mb-1.5 block text-[9px] uppercase tracking-wider text-muted-foreground">City</span><select value={city} onChange={(e) => setCity(e.target.value)} className="h-11 w-full border border-input bg-background px-3 text-sm"><option>All cities</option>{Array.from(new Set(equipment.map((item) => item.city))).map((item) => <option key={item}>{item}</option>)}</select></label></div><div className="mt-8 grid gap-5 sm:grid-cols-2 xl:grid-cols-4">{filtered.map((item) => <EquipmentCard key={item.id} item={item} />)}</div>{filtered.length === 0 && <div className="border border-dashed border-border py-16 text-center"><Wrench className="mx-auto mb-3 text-muted-foreground" /><p className="font-semibold">No machines match these filters.</p><button onClick={() => { setQuery(''); setType('All equipment'); setCity('All cities'); }} className="mt-3 text-xs font-bold text-primary underline underline-offset-4">Reset filters</button></div>}</div></PageFrame>;
}

function HowItWorksPage() {
  return <PageFrame><div className="px-5 py-12 lg:px-9 lg:py-20"><SectionLabel eyebrow="Operating model / 03" title="A booking that does not leave gaps." body="Customers, owners, operators, and administrators see the same state changes — from the first request to the last work hour." /><div className="grid gap-4 md:grid-cols-3">{[['01', 'Customer details', 'Sign in with Clerk, then keep name, phone, and email attached to the booking request.'], ['02', 'Payment authorization', 'Choose a method and complete the payment step before the booking is confirmed.'], ['03', 'Booking confirmation', 'Once payment is successful, the owner receives a confirmed work order and the customer can track it.'], ['04', 'Fleet telemetry', 'ECU-enabled machines report temperature, mileage, work hours, fuel, and movement.'], ['05', 'Operations status', 'Location, transit, on-site, idle, and completed states are visible as notifications.'], ['06', 'Owner console', 'Owners can add machines, set rates, and monitor active work orders from a separate portal.']].map(([number, title, body]) => <div key={number} className="border border-border bg-card p-5"><div className="mono-font text-[10px] text-primary">/ {number}</div><h3 className="mt-5 text-lg font-bold">{title}</h3><p className="mt-2 text-sm leading-6 text-muted-foreground">{body}</p></div>)}</div></div></PageFrame>;
}

function AuthPage({ mode }: { mode: 'sign-in' | 'sign-up' }) {
  if (localDemoMode) {
    const auth = useContext(LocalAuthContext);
    const [location] = useLocation();
    const [form, setForm] = useState({ name: '', email: '', phone: '', password: '', role: 'customer' as WorkspaceUser['role'] });
    const [error, setError] = useState('');
    const submit = (event: FormEvent) => {
      event.preventDefault();
      if (!auth) return;
      let authenticatedUser: WorkspaceUser;
      if (mode === 'sign-up') {
        authenticatedUser = {
          fullName: form.name || 'RentBuild user',
          primaryEmailAddress: { emailAddress: form.email || 'user@rentbuild.local' },
          role: form.role,
        };
        auth.register(authenticatedUser, form.password);
      } else {
        const signedInUser = auth.login(form.email, form.password);
        if (!signedInUser) {
          setError('Invalid user ID or password.');
          return;
        }
        authenticatedUser = signedInUser;
      }
      const requestedRole = new URLSearchParams(location.split('?')[1] ?? '').get('role');
      const isOwnerRequest = requestedRole === 'owner';
      const destination = mode === 'sign-up'
        ? form.role === 'admin' ? '/admin' : form.role === 'owner' ? '/owner/dashboard' : form.role === 'operator' ? '/fleet' : '/'
        : authenticatedUser.role === 'owner' || isOwnerRequest
          ? '/owner/dashboard'
          : authenticatedUser.role === 'admin'
            ? '/admin'
            : authenticatedUser.role === 'operator'
              ? '/fleet'
              : '/';
      window.history.pushState({}, '', `${basePath}${destination}`);
      window.dispatchEvent(new PopStateEvent('popstate'));
    };
    return <div className="flex min-h-[100dvh] items-center justify-center bg-background px-5 py-10"><form onSubmit={submit} className="w-full max-w-md border border-border bg-card p-7"><Logo /><h1 className="display-font mt-8 text-4xl font-bold uppercase">{mode === 'sign-in' ? 'Sign in locally' : 'Create account'}</h1><p className="mt-3 text-sm leading-6 text-muted-foreground">Use the credentials for the account type you want to access. Owner login opens the owner workspace; administrator login opens the control room.</p>{mode === 'sign-up' && <input required placeholder="Full name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="mt-6 h-11 w-full border border-input bg-background px-3 text-sm" />}<input required type="email" placeholder="Email / user ID" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className="mt-3 h-11 w-full border border-input bg-background px-3 text-sm" /><input required type="password" minLength={8} placeholder="Password (8+ characters)" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} className="mt-3 h-11 w-full border border-input bg-background px-3 text-sm" />{mode === 'sign-up' && <><input required placeholder="Phone number" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} className="mt-3 h-11 w-full border border-input bg-background px-3 text-sm" /><select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value as WorkspaceUser['role'] })} className="mt-3 h-11 w-full border border-input bg-background px-3 text-sm"><option value="customer">Customer</option><option value="owner">Equipment owner</option><option value="operator">Operator</option></select></>}{error && <p className="mt-3 text-xs text-red-400">{error}</p>}<button className="mt-6 flex h-11 w-full items-center justify-center gap-2 bg-primary text-xs font-bold text-primary-foreground">{mode === 'sign-in' ? 'SIGN IN' : 'REGISTER AND CONTINUE'} <ArrowRight size={15} /></button><Link href={mode === 'sign-in' ? '/sign-up' : '/sign-in'} className="mt-5 block text-center text-xs font-semibold text-primary">{mode === 'sign-in' ? 'Need an account? Register' : 'Already registered? Sign in'}</Link></form></div>;
  }
  const path = `${basePath}/${mode}`;
  const AuthComponent = mode === 'sign-in' ? SignIn : SignUp;
  return <div className="flex min-h-[100dvh] items-center justify-center bg-background px-4 py-10"><div className="w-full max-w-5xl"><div className="mb-8 flex justify-center"><Link href="/"><Logo /></Link></div><div className="grid gap-8 lg:grid-cols-[.8fr_1fr] lg:items-center"><div className="hidden lg:block"><div className="mono-font flex items-center gap-2 text-[10px] font-bold uppercase tracking-[.2em] text-primary"><span className="h-px w-7 bg-primary" />Access / RB India</div><h1 className="display-font mt-4 text-6xl font-bold uppercase leading-[.86]">Your next shift starts here.</h1><p className="mt-6 max-w-md text-sm leading-6 text-muted-foreground">Use your customer account to save machines, confirm a payment, track a booking, and keep every job detail in one place.</p><div className="mt-7 grid gap-3 text-xs text-muted-foreground"><div className="flex items-center gap-3"><ShieldCheck size={16} className="text-primary" />Verified marketplace accounts</div><div className="flex items-center gap-3"><LockKeyhole size={16} className="text-primary" />Protected sign-in with Clerk</div><div className="flex items-center gap-3"><Bell size={16} className="text-primary" />Booking and fleet status notifications</div></div></div><div className="flex justify-center"><AuthComponent routing="path" path={path} signInUrl={`${basePath}/sign-in`} signUpUrl={`${basePath}/sign-up`} appearance={clerkAppearance} /></div></div></div></div>;
}

function AdminLoginPage() {
  const auth = useWorkspaceAuth();
  const local = useContext(LocalAuthContext);
  const [form, setForm] = useState({ userId: '', password: '' });
  const [error, setError] = useState('');
  const submit = (event: FormEvent) => {
    event.preventDefault();
    const adminUserId = (import.meta.env.VITE_ADMIN_USER_ID || 'admin@rentbuild.in').toLowerCase();
    const adminPassword = import.meta.env.VITE_ADMIN_PASSWORD || 'Admin2026';
    if (localDemoMode && form.userId.trim().toLowerCase() === adminUserId && form.password === adminPassword) {
      local?.register({
        fullName: 'RentBuild Administrator',
        primaryEmailAddress: { emailAddress: adminUserId },
        role: 'admin',
      }, adminPassword);
      window.location.href = `${basePath}/admin`;
      return;
    }
    setError('Invalid administrator credentials.');
  };
  if (localDemoMode) return <div className="flex min-h-[100dvh] items-center justify-center bg-background px-5"><form onSubmit={submit} className="w-full max-w-md border border-border bg-card p-7"><Logo /><div className="mt-7 grid h-12 w-12 place-items-center bg-primary text-primary-foreground"><ShieldCheck size={22} /></div><h1 className="display-font mt-5 text-4xl font-bold uppercase">Admin login</h1><p className="mt-2 text-sm leading-6 text-muted-foreground">Use the separate administrator user ID and password. Customer accounts cannot access this console.</p><input required placeholder="Admin user ID" value={form.userId} onChange={(e) => setForm({ ...form, userId: e.target.value })} className="mt-6 h-11 w-full border border-input bg-background px-3 text-sm" /><input required type="password" placeholder="Admin password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} className="mt-3 h-11 w-full border border-input bg-background px-3 text-sm" />{error && <p className="mt-3 text-xs text-red-400">{error}</p>}<button className="mt-6 flex h-11 w-full items-center justify-center gap-2 bg-primary text-xs font-bold text-primary-foreground">SIGN IN AS ADMIN <ArrowRight size={15} /></button><p className="mt-4 text-[10px] text-muted-foreground">Configure VITE_ADMIN_USER_ID and VITE_ADMIN_PASSWORD for the local demo.</p></form></div>;
  const { user } = useWorkspaceUser();
  return <div className="flex min-h-[100dvh] items-center justify-center bg-background px-5"><div className="w-full max-w-md border border-border bg-card p-7"><Link href="/" className="mb-10 inline-flex"><Logo /></Link><div className="grid h-12 w-12 place-items-center bg-primary text-primary-foreground"><ShieldCheck size={22} /></div><h1 className="display-font mt-6 text-4xl font-bold uppercase">Admin access</h1><p className="mt-2 text-sm leading-6 text-muted-foreground">A separate console for users, bookings, notifications, and ECU operations. Admin permissions are applied to your managed account.</p>{auth.isSignedIn && user?.role === 'admin' ? <Link href="/admin" className="mt-7 flex h-12 items-center justify-center gap-2 bg-primary text-sm font-bold text-primary-foreground">CONTINUE TO ADMIN CONSOLE <ArrowRight size={15} /></Link> : <Link href="/sign-in" className="mt-7 flex h-12 items-center justify-center gap-2 bg-primary text-sm font-bold text-primary-foreground">SIGN IN AS ADMIN <LogIn size={15} /></Link>}{auth.isSignedIn && user?.role !== 'admin' && <p className="mt-4 text-center text-xs text-red-400">This account is not assigned the administrator role.</p>}<Link href="/" className="mt-5 flex items-center justify-center gap-2 text-xs font-semibold text-muted-foreground"><ArrowLeft size={13} /> Back to marketplace</Link></div></div>;
}

function ProtectedPage({ children }: { children: ReactNode }) {
  const { isLoaded, isSignedIn } = useWorkspaceAuth();
  if (!isLoaded) return <LoadingPage />;
  if (!isSignedIn) return <Redirect to="/sign-in" />;
  return <>{children}</>;
}

function AdminOnly({ children }: { children: ReactNode }) {
  const { user } = useWorkspaceUser();
  if (user?.role !== 'admin') return <Redirect to="/admin/login" />;
  return <>{children}</>;
}

function OwnerOrAdmin({ children }: { children: ReactNode }) {
  const { isLoaded, isSignedIn } = useWorkspaceAuth();
  const { user } = useWorkspaceUser();
  if (!isLoaded) return <LoadingPage />;
  if (!isSignedIn) return <Redirect to="/sign-in" />;
  if (localDemoMode && user?.role !== 'owner' && user?.role !== 'admin') return <Redirect to="/owner/dashboard" />;
  return <>{children}</>;
}

function LoadingPage() {
  return <div className="grid min-h-[100dvh] place-items-center bg-background text-foreground"><div className="text-center"><div className="mx-auto h-9 w-9 animate-spin rounded-full border-2 border-border border-t-primary" /><p className="mono-font mt-4 text-[10px] uppercase tracking-widest text-muted-foreground">Loading workspace</p></div></div>;
}

function ProfilePage() {
  const { profile, setProfile, addNotification } = useAppState();
  const { user } = useWorkspaceUser();
  const [form, setForm] = useState(profile);
  const save = (event: FormEvent) => { event.preventDefault(); setProfile(form); addNotification({ title: 'Profile details updated', body: 'Your customer details are ready for the next booking.', kind: 'system', read: false }); };
  return <PageFrame><div className="px-5 py-12 lg:px-9 lg:py-20"><SectionLabel eyebrow="Account / 01" title="Your customer details." body="These details are required before payment so the owner knows who is responsible for the job site." /><div className="grid max-w-4xl gap-8 lg:grid-cols-[.7fr_1fr]"><div className="border border-border bg-card p-6"><div className="grid h-14 w-14 place-items-center bg-primary text-primary-foreground"><UserRound size={26} /></div><h3 className="mt-5 text-xl font-bold">{user?.fullName || form.name || 'Customer account'}</h3><p className="mt-2 text-sm leading-6 text-muted-foreground">{user?.primaryEmailAddress?.emailAddress || form.email || 'Add your contact details to unlock bookings.'}</p><div className="mt-7 space-y-3 text-xs text-muted-foreground"><div className="flex items-center gap-2"><Check size={14} className="text-emerald-400" />Clerk sign-in connected</div><div className="flex items-center gap-2"><Check size={14} className={form.phone ? 'text-emerald-400' : 'text-muted-foreground'} />Phone number {form.phone ? 'saved' : 'still required'}</div></div></div><form onSubmit={save} className="border border-border bg-card p-6"><div className="grid gap-4"><label><span className="mono-font mb-1.5 block text-[9px] uppercase tracking-wider text-muted-foreground">Full name *</span><input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="h-11 w-full border border-input bg-background px-3 text-sm" placeholder="Your name" /></label><label><span className="mono-font mb-1.5 block text-[9px] uppercase tracking-wider text-muted-foreground">Phone number *</span><input required type="tel" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} className="h-11 w-full border border-input bg-background px-3 text-sm" placeholder="+91 98765 43210" /></label><label><span className="mono-font mb-1.5 block text-[9px] uppercase tracking-wider text-muted-foreground">Email ID *</span><input required type="email" value={form.email || user?.primaryEmailAddress?.emailAddress || ''} onChange={(e) => setForm({ ...form, email: e.target.value })} className="h-11 w-full border border-input bg-background px-3 text-sm" placeholder="you@company.com" /></label></div><button className="mt-6 flex h-11 w-full items-center justify-center gap-2 bg-primary text-xs font-bold text-primary-foreground"><Check size={15} /> SAVE CUSTOMER DETAILS</button></form></div></div></PageFrame>;
}

function BookingPage() {
  const { id } = useParams<{ id: string }>();
  const { equipment, profile, setProfile, addBooking, addNotification } = useAppState();
  const { user } = useWorkspaceUser();
  const [, setLocation] = useLocation();
  const item = equipment.find((machine) => machine.id === id) ?? equipment[0];
  const [step, setStep] = useState(1);
  const [details, setDetails] = useState<UserProfile>({ name: profile.name || user?.fullName || '', phone: profile.phone, email: profile.email || user?.primaryEmailAddress?.emailAddress || '' });
  const [paymentMethod, setPaymentMethod] = useState('UPI / VPA');
  const [paymentStatus, setPaymentStatus] = useState<'idle' | 'authorizing' | 'paid'>('idle');
  const [bookingId, setBookingId] = useState('');
  const [location, setDeliveryLocation] = useState(item.city);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [scheduleError, setScheduleError] = useState('');
  const startAt = startDate ? new Date(startDate).getTime() : 0;
  const endAt = endDate ? new Date(endDate).getTime() : 0;
  const rentalDays = startAt && endAt && endAt > startAt ? Math.max(1, Math.ceil((endAt - startAt) / (24 * 60 * 60 * 1000))) : 0;
  const rentalSubtotal = item.price * rentalDays;
  const platformFee = Math.round(rentalSubtotal * .08);
  const gst = Math.round(rentalSubtotal * .18);
  const total = rentalSubtotal + platformFee + gst;
  const saveDetails = (event: FormEvent) => {
    event.preventDefault();
    if (!startDate || !endDate || endAt <= startAt) {
      setScheduleError('Select a valid end date and time after the start date and time.');
      return;
    }
    setScheduleError('');
    setProfile(details);
    addNotification({ title: 'Booking details saved', body: `${details.name}, your contact details are attached to this request.`, kind: 'booking', read: false });
    setStep(2);
  };
  const authorizePayment = () => { setPaymentStatus('authorizing'); window.setTimeout(() => { setPaymentStatus('paid'); addNotification({ title: 'Payment authorized', body: `Payment preference ${paymentMethod} is ready for ${item.name}.`, kind: 'payment', read: false }); setStep(3); }, 900); };
  const confirmBooking = () => { const newId = `RB-${String(Date.now()).slice(-6)}`; setBookingId(newId); addBooking({ id: newId, equipmentId: item.id, equipmentName: item.name, location, startDate, endDate, total, paymentMethod, paymentStatus: 'paid', status: 'confirmed', createdAt: new Date().toISOString() }); addNotification({ title: 'Booking confirmed', body: `${item.name} is reserved for ${location}.`, kind: 'booking', read: false }); setStep(4); };
  const paymentMethods = ['UPI / VPA', 'UPI QR', 'UPI Intent', 'Card', 'Net banking', 'Wallets (GPay / PhonePe / Paytm)'];
  return <PageFrame><div className="px-5 py-12 lg:px-9 lg:py-20"><Link href="/browse" className="mb-7 inline-flex items-center gap-2 text-xs font-semibold text-muted-foreground"><ArrowLeft size={14} /> Back to equipment</Link><div className="grid gap-8 lg:grid-cols-[1fr_.75fr]"><div><div className="mono-font text-[10px] uppercase tracking-[.18em] text-primary">Protected booking / {String(step).padStart(2, '0')} of 04</div><h1 className="display-font mt-3 text-5xl font-bold uppercase leading-[.9]">{step === 1 ? 'Schedule your machine.' : step === 2 ? 'Choose payment.' : step === 3 ? 'Review before booking.' : 'Your machine is reserved.'}</h1><div className="mt-8 grid grid-cols-4 gap-2">{[['1', 'Details'], ['2', 'Payment'], ['3', 'Review'], ['4', 'Confirmed']].map(([number, label], index) => <div key={number} className={`border-t-2 pt-2 ${step > index ? 'border-primary text-foreground' : 'border-border text-muted-foreground'}`}><div className="mono-font text-[10px]">{number}</div><div className="mt-1 text-[10px] font-semibold">{label}</div></div>)}</div>{step === 1 && <form onSubmit={saveDetails} className="mt-8 max-w-xl border border-border bg-card p-6"><div className="mb-6 flex items-start gap-3 border-l-2 border-primary bg-primary/5 p-4 text-xs leading-5 text-muted-foreground"><LockKeyhole size={16} className="mt-0.5 shrink-0 text-primary" />Choose the work schedule and provide contact details before payment is authorized.</div><div className="grid gap-4 sm:grid-cols-2"><label><span className="mono-font mb-1.5 block text-[9px] uppercase tracking-wider text-muted-foreground">Start date and time *</span><input required type="datetime-local" value={startDate} onChange={(e) => { setStartDate(e.target.value); setScheduleError(''); }} className="h-11 w-full border border-input bg-background px-3 text-sm" /></label><label><span className="mono-font mb-1.5 block text-[9px] uppercase tracking-wider text-muted-foreground">End date and time *</span><input required type="datetime-local" min={startDate || undefined} value={endDate} onChange={(e) => { setEndDate(e.target.value); setScheduleError(''); }} className="h-11 w-full border border-input bg-background px-3 text-sm" /></label><label className="sm:col-span-2"><span className="mono-font mb-1.5 block text-[9px] uppercase tracking-wider text-muted-foreground">Full name *</span><input required value={details.name} onChange={(e) => setDetails({ ...details, name: e.target.value })} className="h-11 w-full border border-input bg-background px-3 text-sm" placeholder="Responsible person" /></label><label><span className="mono-font mb-1.5 block text-[9px] uppercase tracking-wider text-muted-foreground">Phone number *</span><input required type="tel" value={details.phone} onChange={(e) => setDetails({ ...details, phone: e.target.value })} className="h-11 w-full border border-input bg-background px-3 text-sm" placeholder="+91 98765 43210" /></label><label><span className="mono-font mb-1.5 block text-[9px] uppercase tracking-wider text-muted-foreground">Email ID *</span><input required type="email" value={details.email} onChange={(e) => setDetails({ ...details, email: e.target.value })} className="h-11 w-full border border-input bg-background px-3 text-sm" placeholder="you@company.com" /></label><label className="sm:col-span-2"><span className="mono-font mb-1.5 block text-[9px] uppercase tracking-wider text-muted-foreground">Delivery location *</span><input required value={location} onChange={(e) => setDeliveryLocation(e.target.value)} className="h-11 w-full border border-input bg-background px-3 text-sm" placeholder="Job site city" /></label></div>{scheduleError && <p className="mt-4 text-xs text-red-400">{scheduleError}</p>}<button className="mt-6 flex h-11 w-full items-center justify-center gap-2 bg-primary text-xs font-bold text-primary-foreground">CONTINUE TO PAYMENT <ArrowRight size={15} /></button></form>}{step === 2 && <div className="mt-8 max-w-xl border border-border bg-card p-6"><div className="flex items-center justify-between"><div><div className="mono-font text-[10px] uppercase tracking-wider text-primary">Razorpay checkout</div><h2 className="mt-2 text-xl font-bold">Select a payment method.</h2></div><CreditCard className="text-primary" /></div><div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{paymentMethods.map((method) => <button key={method} onClick={() => setPaymentMethod(method)} className={`min-h-[92px] border p-3 text-left ${paymentMethod === method ? 'border-primary bg-primary/10' : 'border-border hover:border-primary/60'}`}><div className="grid h-7 w-7 place-items-center bg-background text-primary">{method.includes('UPI') ? <Zap size={14} /> : method === 'Card' ? <CreditCard size={14} /> : <WalletCards size={14} />}</div><div className="mt-3 text-xs font-bold">{method}</div></button>)}</div><div className="mt-6 border-t border-border pt-4 text-xs text-muted-foreground">Razorpay supports UPI QR, UPI Intent, cards, net banking, Google Pay, PhonePe, and Paytm. Live payment capture starts when Razorpay keys are configured; local mode records a safe demo authorization.</div><button onClick={authorizePayment} disabled={paymentStatus === 'authorizing'} className="mt-6 flex h-11 w-full items-center justify-center gap-2 bg-primary text-xs font-bold text-primary-foreground disabled:opacity-60">{paymentStatus === 'authorizing' ? 'AUTHORIZING PAYMENT…' : 'AUTHORIZE PAYMENT'} <ArrowRight size={15} /></button></div>}{step === 3 && <div className="mt-8 max-w-xl border border-border bg-card p-6"><div className="flex items-start gap-3 border border-emerald-400/30 bg-emerald-400/10 p-4"><Check size={18} className="text-emerald-400" /><div><div className="text-sm font-bold">Payment authorized</div><div className="mt-1 text-xs text-muted-foreground">Now confirm the booking separately so the owner can receive the work order.</div></div></div><div className="mt-6 space-y-3 text-sm"><div className="flex justify-between border-b border-border pb-3"><span className="text-muted-foreground">Customer</span><b>{details.name}</b></div><div className="flex justify-between border-b border-border pb-3"><span className="text-muted-foreground">Delivery</span><b>{location}</b></div><div className="flex justify-between border-b border-border pb-3"><span className="text-muted-foreground">Payment</span><b>{paymentMethod}</b></div><div className="flex justify-between pt-2"><span className="font-bold">Total</span><b className="text-xl text-primary">₹{fmt(total)}</b></div></div><button onClick={confirmBooking} className="mt-7 flex h-12 w-full items-center justify-center gap-2 bg-primary text-sm font-bold text-primary-foreground">CONFIRM BOOKING <Check size={16} /></button></div>}{step === 4 && <div className="mt-8 max-w-xl border border-emerald-400/30 bg-emerald-400/10 p-6"><div className="grid h-12 w-12 place-items-center rounded-full bg-emerald-400 text-[#132219]"><Check size={23} /></div><h2 className="mt-5 text-2xl font-bold">Booking confirmed.</h2><p className="mt-2 text-sm leading-6 text-muted-foreground">The owner has been notified and the equipment is reserved for your site. Your payment authorization and booking confirmation are both recorded.</p><div className="mt-6 grid gap-3 sm:grid-cols-2"><div className="border border-border bg-background/40 p-4"><div className="text-xs text-muted-foreground">Booking ID</div><div className="mt-1 font-bold">{bookingId}</div></div><div className="border border-border bg-background/40 p-4"><div className="text-xs text-muted-foreground">Next state</div><div className="mt-1 font-bold text-primary">Owner confirmation</div></div></div><div className="mt-6 flex flex-wrap gap-3"><Link href="/bookings" className="flex h-11 items-center gap-2 bg-primary px-4 text-xs font-bold text-primary-foreground">VIEW MY BOOKINGS <ArrowRight size={14} /></Link><Link href="/notifications" className="flex h-11 items-center gap-2 border border-border px-4 text-xs font-bold hover:border-primary"><Bell size={14} /> VIEW NOTIFICATIONS</Link></div></div>}</div><aside className="h-fit border border-border bg-card p-5 lg:sticky lg:top-24"><div className="mono-font text-[10px] uppercase tracking-wider text-primary">Selected equipment</div><div className="mt-4"><EquipmentIllustration kind={item.image} initials={item.type.slice(0, 3).toUpperCase()} /><h2 className="mt-4 text-lg font-bold">{item.name}</h2><div className="mt-2 flex items-center gap-2 text-xs text-muted-foreground"><MapPin size={13} />{item.city} · {item.owner}</div></div>  <div className="mt-5 space-y-3 border-t border-border pt-4 text-xs"><div className="flex justify-between"><span className="text-muted-foreground">Rental × {rentalDays || 0} days</span><span>₹{fmt(rentalSubtotal)}</span></div><div className="flex justify-between"><span className="text-muted-foreground">Delivery &amp; platform</span><span>₹{fmt(platformFee)}</span></div><div className="flex justify-between"><span className="text-muted-foreground">GST</span><span>₹{fmt(gst)}</span></div><div className="flex justify-between border-t border-border pt-3 text-sm font-bold"><span>Estimated total</span><span className="text-primary">₹{fmt(total)}</span></div>{rentalDays > 0 && <div className="text-[10px] text-muted-foreground">{rentalDays} billable day{rentalDays === 1 ? '' : 's'} based on the selected schedule.</div>}</div><div className="mt-5 flex items-center gap-2 text-[10px] text-muted-foreground"><ShieldCheck size={14} className="text-primary" />Rate locked before confirmation</div></aside></div></div></PageFrame>;
}

function BookingsPage() {
  const { bookings, updateBooking, addNotification } = useAppState();
  const cancelBooking = (booking: Booking) => {
    const cancellationFee = Math.round(booking.total * 0.05);
    const refundAmount = booking.total - cancellationFee;
    updateBooking(booking.id, { status: 'cancelled', paymentStatus: 'refunded', cancellationFee, refundAmount });
    addNotification({ title: 'Booking cancelled', body: `${booking.id} was cancelled. A 5% cancellation charge of ₹${fmt(cancellationFee)} was applied and ₹${fmt(refundAmount)} will be refunded.`, kind: 'booking', read: false });
    addNotification({ title: 'Refund initiated', body: `Payment refund of ₹${fmt(refundAmount)} for ${booking.id} has been initiated.`, kind: 'payment', read: false });
  };
  return <PageFrame><div className="px-5 py-12 lg:px-9 lg:py-20"><SectionLabel eyebrow="Customer portal / 02" title="My bookings." body="Payment, booking, location, and operation status stay visible after confirmation." /><div className="grid gap-4">{bookings.length === 0 ? <div className="border border-dashed border-border p-12 text-center"><ClipboardList className="mx-auto mb-3 text-muted-foreground" /><p className="font-semibold">No bookings yet.</p><Link href="/browse" className="mt-4 inline-flex items-center gap-2 text-xs font-bold text-primary">Browse equipment <ArrowRight size={14} /></Link></div> : bookings.map((booking) => { const canCancel = ['payment-confirmed', 'confirmed'].includes(booking.status); const formatDate = (value: string) => new Date(value).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' }); return <article key={booking.id} className="border border-border bg-card p-5"><div className="flex flex-col justify-between gap-5 md:flex-row md:items-start"><div><div className="mono-font text-[10px] text-primary">{booking.id} · {booking.createdAt.slice(0, 10)}</div><h2 className="mt-2 text-lg font-bold">{booking.equipmentName}</h2><div className="mt-2 flex flex-wrap gap-4 text-xs text-muted-foreground"><span className="flex items-center gap-1"><MapPin size={13} />{booking.location}</span><span className="flex items-center gap-1"><CalendarDays size={13} />{formatDate(booking.startDate)} — {formatDate(booking.endDate)}</span></div></div><div className="flex flex-wrap gap-2 text-[10px] font-bold uppercase"><span className={`border px-2 py-1 ${booking.paymentStatus === 'refunded' ? 'border-sky-400/30 bg-sky-400/10 text-sky-300' : 'border-emerald-400/30 bg-emerald-400/10 text-emerald-400'}`}>Payment {booking.paymentStatus}</span><span className="border border-primary/30 bg-primary/10 px-2 py-1 text-primary">{booking.status.replace('-', ' ')}</span></div></div>{booking.status === 'cancelled' && <div className="mt-5 border-l-2 border-sky-400 bg-sky-400/10 p-3 text-xs text-muted-foreground">Cancellation charge: <b>₹{fmt(booking.cancellationFee ?? 0)}</b> · Refund: <b>₹{fmt(booking.refundAmount ?? 0)}</b></div>}<div className="mt-5 grid gap-3 border-t border-border pt-4 sm:grid-cols-4"><div><div className="text-[10px] text-muted-foreground">Total</div><div className="mt-1 font-bold text-primary">₹{fmt(booking.total)}</div></div><div><div className="text-[10px] text-muted-foreground">Next update</div><div className="mt-1 font-semibold">{booking.status === 'cancelled' ? 'Refund processing' : 'Owner confirmation'}</div></div><div><div className="text-[10px] text-muted-foreground">Location feed</div><div className="mt-1 font-semibold text-emerald-400">{booking.status === 'cancelled' ? 'Stopped' : 'Ready'}</div></div>{canCancel ? <button onClick={() => cancelBooking(booking)} className="text-left text-xs font-bold text-red-400 hover:text-red-300 sm:text-right">CANCEL BOOKING · 5% FEE</button> : <Link href="/notifications" className="flex items-center gap-2 text-xs font-bold text-primary sm:justify-end">VIEW STATUS <ArrowRight size={13} /></Link>}</div></article>; })}</div></div></PageFrame>;
}

function NotificationsPage() {
  const { notifications, markNotificationsRead } = useAppState();
  useEffect(() => { markNotificationsRead(); }, [markNotificationsRead]);
  return <PageFrame><div className="px-5 py-12 lg:px-9 lg:py-20"><div className="flex items-end justify-between gap-5"><SectionLabel eyebrow="Operations feed / 03" title="Notifications." body="Booking states, payment events, vehicle location, and ECU operation signals arrive in one timeline." /><button onClick={markNotificationsRead} className="mb-7 hidden items-center gap-2 border border-border px-3 py-2 text-xs font-bold hover:border-primary sm:flex"><Check size={14} /> MARK ALL READ</button></div><div className="grid gap-3">{notifications.map((notification) => <article key={notification.id} className={`flex gap-4 border border-border bg-card p-5 ${!notification.read ? 'border-l-2 border-l-primary' : ''}`}><div className={`grid h-10 w-10 shrink-0 place-items-center ${notification.kind === 'payment' ? 'bg-emerald-400/15 text-emerald-400' : notification.kind === 'location' ? 'bg-sky-400/15 text-sky-300' : 'bg-primary/15 text-primary'}`}>{notification.kind === 'location' ? <MapPin size={18} /> : notification.kind === 'payment' ? <CreditCard size={18} /> : notification.kind === 'operation' ? <Gauge size={18} /> : <Bell size={18} />}</div><div className="min-w-0"><div className="flex flex-wrap items-center gap-3"><h2 className="text-sm font-bold">{notification.title}</h2><span className="text-[10px] text-muted-foreground">{notification.time}</span></div><p className="mt-1 text-sm leading-6 text-muted-foreground">{notification.body}</p></div></article>)}</div></div></PageFrame>;
}

function FleetPage() {
  const { equipment, sensors, setSensors, addNotification } = useAppState();
  const { user } = useWorkspaceUser();
  const visibleEquipment = user?.role === 'admin'
    ? equipment
    : user?.role === 'owner'
      ? equipment.filter((item) => item.ownerEmail === user.primaryEmailAddress.emailAddress)
      : [];
  const [selectedId, setSelectedId] = useState('');
  const selected = visibleEquipment.find((item) => item.id === selectedId) ?? visibleEquipment[0];
  if (!selected) return <PageFrame><div className="px-5 py-20"><SectionLabel eyebrow="Fleet access" title="No assigned vehicles yet." body={user?.role === 'customer' ? 'Fleet tracking appears after you complete a booking.' : 'List equipment or ask an administrator to assign a vehicle before opening telemetry.'} /><Link href="/browse" className="mt-5 inline-flex bg-primary px-4 py-3 text-xs font-bold text-primary-foreground">BROWSE EQUIPMENT <ArrowRight size={14} /></Link></div></PageFrame>;
  const sensor: SensorData = {
    ...defaultSensor,
    ...(sensors[selected.id] ?? {}),
  };
  useEffect(() => {
    const timer = window.setInterval(() => {
      setSensors((current) => {
        const latest = current[selected.id] ?? sensor;
        return {
          ...current,
          [selected.id]: {
            ...latest,
            temperature: Number((latest.temperature + .1).toFixed(1)),
            workHours: Number((latest.workHours + .01).toFixed(2)),
            engineRpm: latest.engineStatus === 'Stopped' ? 0 : Math.max(0, latest.engineRpm + (latest.engineStatus === 'Running' ? 4 : -2)),
            oilPressure: latest.engineStatus === 'Stopped' ? 0 : Number(Math.max(0, latest.oilPressure + .01).toFixed(2)),
            hydraulicPressure: latest.engineStatus === 'Stopped' ? 0 : Number(Math.max(0, latest.hydraulicPressure + .2).toFixed(1)),
            lastSync: 'just now',
          },
        };
      });
    }, 5000);
    return () => window.clearInterval(timer);
  }, [selected.id]);
  const toggleEngine = () => { const next = sensor.engineStatus === 'Running' ? 'Stopped' : 'Running'; setSensors({ ...sensors, [selected.id]: { ...sensor, engineStatus: next, lastSync: 'just now' } }); addNotification({ title: `Engine ${next.toLowerCase()}`, body: `${selected.name} operation status changed in the ECU feed.`, kind: 'operation', read: false }); };
  const isDump = selected.type === 'Dump truck';
  const hasCoordinates = sensor.latitude !== 0 || sensor.longitude !== 0;
  const mapQuery = hasCoordinates ? `${sensor.latitude},${sensor.longitude}` : `${selected.city}, India`;
  const mapUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(mapQuery)}`;
  const mapEmbedUrl = `https://www.google.com/maps?q=${encodeURIComponent(mapQuery)}&z=${hasCoordinates ? 15 : 12}&output=embed`;
  return <PageFrame><div className="px-5 py-12 lg:px-9 lg:py-20"><div className="flex flex-col justify-between gap-5 md:flex-row md:items-end"><SectionLabel eyebrow="ECU fleet / 04" title="Know the machine." body="Monitor live simulated ECU readings for every vehicle registered to your owner account. Administrators can see the entire fleet." /><div className="flex items-center gap-2 border border-emerald-400/30 bg-emerald-400/10 px-3 py-2 text-[10px] font-bold text-emerald-400"><Radio size={14} /> ECU BRIDGE ONLINE</div></div><div className="mt-8 grid gap-8 lg:grid-cols-[.75fr_1.25fr]"><aside className="border border-border bg-card p-4"><div className="mono-font text-[10px] uppercase tracking-wider text-primary">Your connected assets</div><div className="mt-4 grid gap-2">{visibleEquipment.slice(0, 10).map((item) => <button key={item.id} onClick={() => setSelectedId(item.id)} className={`flex items-center gap-3 border p-3 text-left ${selected.id === item.id ? 'border-primary bg-primary/10' : 'border-border hover:border-primary/60'}`}><div className="grid h-9 w-9 place-items-center bg-background text-primary"><Truck size={16} /></div><div className="min-w-0"><div className="truncate text-xs font-bold">{item.name}</div><div className="mt-1 text-[10px] text-muted-foreground">{item.type} · {item.city}</div></div><span className="ml-auto h-2 w-2 rounded-full bg-emerald-400" /></button>)}</div></aside><div><div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">{[['GPS location', hasCoordinates ? `${sensor.latitude.toFixed(5)}, ${sensor.longitude.toFixed(5)}` : `${selected.city} (city)`, MapPin], ['Engine RPM', `${Math.round(sensor.engineRpm)} rpm`, Activity], ['Oil pressure', `${sensor.oilPressure.toFixed(2)} bar`, Gauge], ['Hydraulic pressure', `${sensor.hydraulicPressure.toFixed(1)} bar`, SlidersHorizontal], ['Engine temperature', `${sensor.temperature} °C`, Activity], [isDump ? 'KM driven' : 'Mileage', `${isDump ? sensor.kmDriven : sensor.mileage} km`, Gauge], ['Work hours', `${sensor.workHours} h`, Clock3], ['Fuel level', `${sensor.fuel}%`, Zap]].map(([label, value, Icon]) => <div key={label as string} className="border border-border bg-card p-4"><div className="flex items-center gap-2 text-[10px] uppercase tracking-wider text-muted-foreground">{typeof Icon === 'function' ? <Icon size={14} /> : null}{label as string}</div><div className="mono-font mt-4 text-xl font-bold text-primary">{value as string}</div></div>)}</div><div className="mt-4 grid gap-4 lg:grid-cols-[1.2fr_.8fr]"><div className="relative min-h-[320px] overflow-hidden border border-border bg-card"><iframe title={`Google Maps location for ${selected.name}`} src={mapEmbedUrl} className="absolute inset-0 h-full w-full border-0" loading="lazy" referrerPolicy="no-referrer-when-downgrade" /><div className="absolute left-3 top-3 border border-border bg-background/95 px-3 py-2 text-[10px] shadow-lg"><b className="block">{selected.name}</b><span className="text-muted-foreground">{hasCoordinates ? 'Live GPS position' : `Showing ${selected.city} area`}</span><span className="mt-1 block text-emerald-400">{sensor.engineStatus} · {sensor.lastSync}</span></div><div className="absolute bottom-3 left-3 flex items-center gap-2 border border-border bg-background/95 px-3 py-2 text-[10px] text-muted-foreground"><MapPin size={13} className="text-primary" />{hasCoordinates ? 'Vehicle position' : 'City-level position'}<span className="text-border">·</span><a href={mapUrl} target="_blank" rel="noreferrer" className="font-bold text-primary hover:underline">Open in Google Maps</a></div></div><div className="border border-border bg-card p-5"><div className="flex items-start justify-between border-b border-border pb-4"><div><div className="mono-font text-[10px] text-primary">Selected asset</div><h3 className="mt-2 text-lg font-bold">{selected.name}</h3><div className="mt-1 text-xs text-muted-foreground">{selected.owner} · {selected.city}</div></div><span className="border border-emerald-400/30 bg-emerald-400/10 px-2 py-1 text-[10px] font-bold text-emerald-400">{sensor.engineStatus}</span></div><div className="mt-5 grid gap-3 text-xs"><div className="flex justify-between"><span className="text-muted-foreground">Machine type</span><b>{selected.type}</b></div><div className="flex justify-between"><span className="text-muted-foreground">Feed status</span><b className="text-emerald-400">Connected</b></div><div className="flex justify-between"><span className="text-muted-foreground">GPS coordinates</span><b>{hasCoordinates ? `${sensor.latitude.toFixed(5)}, ${sensor.longitude.toFixed(5)}` : 'Waiting for GPS'}</b></div><div className="flex justify-between"><span className="text-muted-foreground">RPM / hydraulic</span><b>{Math.round(sensor.engineRpm)} / {sensor.hydraulicPressure.toFixed(1)} bar</b></div><div className="flex justify-between"><span className="text-muted-foreground">Temperature range</span><b>65–95 °C</b></div></div><button onClick={toggleEngine} className="mt-6 flex h-11 w-full items-center justify-center gap-2 border border-primary text-xs font-bold text-primary hover:bg-primary hover:text-primary-foreground">{sensor.engineStatus === 'Running' ? 'STOP ENGINE PREVIEW' : 'START ENGINE PREVIEW'} <Zap size={14} /></button><div className="mt-4 border-l-2 border-primary bg-primary/5 p-3 text-[11px] leading-5 text-muted-foreground">Booking and vehicle fault events appear in the notification feed. Configure SMTP/SMS providers for real delivery.</div></div></div></div></div></div></PageFrame>;
}

function OwnerShell({ children, title }: { children: ReactNode; title: string }) {
  return <PageFrame><div className="grid lg:grid-cols-[240px_1fr]"><aside className="border-b border-border bg-card p-5 lg:min-h-[calc(100dvh-72px)] lg:border-b-0 lg:border-r lg:p-6"><div className="mono-font text-[10px] uppercase tracking-wider text-primary">Owner workspace</div><h2 className="display-font mt-2 text-3xl font-bold uppercase">{title}</h2><nav className="mt-7 grid gap-1">{[['/owner/dashboard', 'Dashboard', LayoutDashboard], ['/owner/listings', 'My listings', ClipboardList], ['/owner/listings/new', 'Add equipment', PackagePlus], ['/fleet', 'Fleet monitoring', Radio]].map(([href, label, Icon]) => <Link key={href as string} href={href as string} className="flex items-center gap-3 px-3 py-3 text-xs font-semibold text-muted-foreground hover:bg-primary/10 hover:text-primary">{typeof Icon === 'function' ? <Icon size={15} /> : null}{label as string}</Link>)}</nav></aside><section className="min-w-0 px-5 py-10 lg:px-10 lg:py-14">{children}</section></div></PageFrame>;
}

function OwnerDashboardPage() {
  const { equipment, bookings } = useAppState();
  const { user } = useWorkspaceUser();
  const ownerEquipment = equipment.filter((item) => item.ownerEmail === user?.primaryEmailAddress.emailAddress);
  const ownerEquipmentIds = new Set(ownerEquipment.map((item) => item.id));
  const ownerBookings = bookings.filter((booking) => ownerEquipmentIds.has(booking.equipmentId));
  return <OwnerShell title="Owner console"><SectionLabel eyebrow="Operations / 01" title="One board. Every moving part." body="Manage only the equipment registered under your owner account, including its bookings and ECU-connected assets." /><div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">{[[String(ownerEquipment.length), 'Active listings', ClipboardList], [String(ownerBookings.length), 'Confirmed bookings', CalendarDays], [String(ownerEquipment.length), 'ECU connected', Radio], [`₹${fmt(ownerBookings.reduce((sum, booking) => sum + booking.total, 0))}`, 'Gross booked', WalletCards]].map(([value, label, Icon]) => <div key={label as string} className="border border-border bg-card p-5"><div className="flex items-center justify-between"><span className="mono-font text-2xl font-bold text-primary">{value as string}</span>{typeof Icon === 'function' ? <Icon size={17} className="text-primary" /> : null}</div><div className="mt-2 text-xs text-muted-foreground">{label as string}</div></div>)}</div><div className="mt-8 border border-border bg-card p-5"><div className="flex items-center justify-between"><h3 className="text-sm font-bold">Current work orders</h3><Link href="/owner/listings" className="text-xs font-bold text-primary">View listings <ArrowRight className="inline" size={12} /></Link></div><div className="mt-4 overflow-x-auto"><table className="w-full min-w-[620px] text-left text-xs"><thead className="border-y border-border text-[10px] uppercase tracking-wider text-muted-foreground"><tr><th className="py-3">Equipment</th><th className="py-3">Site</th><th className="py-3">State</th><th className="py-3 text-right">Value</th></tr></thead><tbody>{ownerBookings.map((booking) => <tr key={booking.equipmentId} className="border-b border-border last:border-0"><td className="py-4 font-semibold">{booking.equipmentName}</td><td className="py-4 text-muted-foreground">{booking.location}</td><td className="py-4"><span className="rounded-full bg-emerald-400/15 px-2 py-1 text-[10px] text-emerald-400">{booking.status.replace('-', ' ')}</span></td><td className="py-4 text-right font-bold">₹{fmt(booking.total)}</td></tr>)}</tbody></table>{ownerBookings.length === 0 && <p className="py-8 text-center text-xs text-muted-foreground">No bookings for your registered equipment yet.</p>}</div></div></OwnerShell>;
}

function OwnerListingsPage() {
  const { equipment } = useAppState();
  const { user } = useWorkspaceUser();
  const ownerEquipment = equipment.filter((item) => item.ownerEmail === user?.primaryEmailAddress.emailAddress);
  return <OwnerShell title="My listings"><div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end"><SectionLabel eyebrow="Inventory / 02" title="Your machines." body="Only equipment registered from your owner account appears here." /><Link href="/owner/listings/new" className="mb-7 flex h-11 items-center gap-2 bg-primary px-4 text-xs font-bold text-primary-foreground"><PackagePlus size={15} /> ADD EQUIPMENT</Link></div><div className="grid gap-4">{ownerEquipment.map((item) => <article key={item.id} className="flex flex-col gap-4 border border-border bg-card p-4 sm:flex-row sm:items-center"><div className="h-28 w-full shrink-0 sm:w-44"><EquipmentIllustration kind={item.image} initials={item.type.slice(0, 3).toUpperCase()} /></div><div className="min-w-0 flex-1"><div className="mono-font text-[9px] uppercase tracking-wider text-primary">{item.type}</div><h2 className="mt-1 text-lg font-bold">{item.name}</h2><div className="mt-2 flex flex-wrap gap-3 text-xs text-muted-foreground"><span className="flex items-center gap-1"><MapPin size={13} />{item.city}</span><span>Vehicle: <b className="text-foreground">{item.vehicleNumber || 'Not provided'}</b></span><span>RC: <b className="text-foreground">{item.rcCardNumber || 'Not provided'}</b></span></div><div className="mt-2 flex flex-wrap gap-3 text-[10px] text-muted-foreground"><span>{item.workingHours || 0} working hours</span><span>{item.kmDriven || 0} km driven</span><span>Operator: {item.operatorName || 'Not provided'} ({item.operatorExperience || 'N/A'})</span></div></div><div className="flex items-center gap-2 text-xs"><span className={`h-2 w-2 rounded-full ${item.sensorsWorking ? 'bg-emerald-400' : 'bg-red-400'}`} />{item.sensorsWorking ? 'Sensors working' : 'Sensors not verified'}</div></article>)}{ownerEquipment.length === 0 && <div className="border border-dashed border-border p-10 text-center text-xs text-muted-foreground">No equipment is registered to this owner account yet.</div>}</div></OwnerShell>;
}

function NewListingPage() {
  const { addEquipment, addNotification } = useAppState();
  const { user } = useWorkspaceUser();
  const [, setLocation] = useLocation();
  const [form, setForm] = useState({
    name: '', type: 'Excavator', city: 'Bengaluru', price: '4500', vehicleNumber: '', rcCardNumber: '',
    ownerName: user?.fullName || '', ownerPhone: '', ownerEmail: user?.primaryEmailAddress.emailAddress || '',
    operatorName: '', operatorPhone: '', operatorExperience: '', workingHours: '', kmDriven: '',
    sensorsWorking: false, operatorIncluded: true,
  });
  const update = (field: string, value: string | boolean) => setForm((current) => ({ ...current, [field]: value }));
  const submit = (event: FormEvent) => {
    event.preventDefault();
    const id = form.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || `machine-${Date.now()}`;
    addEquipment({
      id, name: form.name, type: form.type, vehicleNumber: form.vehicleNumber, rcCardNumber: form.rcCardNumber,
      city: form.city, price: Number(form.price), rating: 'New', reviews: 0,
      image: form.type === 'Dump truck' ? 'dump' : form.type === 'Crane' ? 'crane' : form.type === 'Loader' ? 'loader' : form.type === 'Generator' ? 'generator' : 'excavator',
      tag: 'New listing', available: 'Today', owner: form.ownerName, ownerEmail: form.ownerEmail, ownerPhone: form.ownerPhone,
      operatorName: form.operatorName, operatorPhone: form.operatorPhone, operatorExperience: form.operatorExperience,
      workingHours: Number(form.workingHours), kmDriven: Number(form.kmDriven), sensorsWorking: form.sensorsWorking,
      operatorIncluded: form.operatorIncluded,
    });
    addNotification({ title: 'New equipment listed', body: `${form.name} is now visible in the marketplace preview.`, kind: 'system', read: false });
    setLocation('/owner/listings');
  };
  const textField = (field: keyof typeof form, label: string, placeholder: string, type = 'text') => (
    <label><span className="mono-font mb-1.5 block text-[9px] uppercase tracking-wider text-muted-foreground">{label} *</span><input required type={type} value={String(form[field])} onChange={(e) => update(field, e.target.value)} className="h-11 w-full border border-input bg-background px-3 text-sm" placeholder={placeholder} /></label>
  );
  return <OwnerShell title="Add equipment"><SectionLabel eyebrow="Inventory / 03" title="Put a machine to work." body="Every vehicle listing must include the machine, meter, sensor, owner, RC, and operator details." /><form onSubmit={submit} className="max-w-3xl border border-border bg-card p-6"><div className="mono-font mb-3 text-[10px] font-bold uppercase tracking-wider text-primary">Vehicle details</div><div className="grid gap-4 sm:grid-cols-2">{textField('name', 'Equipment name', 'e.g. Tata Hitachi ZX210')}<label><span className="mono-font mb-1.5 block text-[9px] uppercase tracking-wider text-muted-foreground">Machine type *</span><select required value={form.type} onChange={(e) => update('type', e.target.value)} className="h-11 w-full border border-input bg-background px-3 text-sm"><option>Excavator</option><option>Dump truck</option><option>Crane</option><option>Loader</option><option>Generator</option></select></label>{textField('vehicleNumber', 'Vehicle number', 'KA 01 AB 1234')}{textField('rcCardNumber', 'RC card number', 'RC-XXXX-XXXX')}{textField('city', 'City', 'Bengaluru')}{textField('price', 'Daily rate (₹)', '4500', 'number')}{textField('workingHours', 'Working hours reading', '0', 'number')}{textField('kmDriven', 'KM driven', '0', 'number')}</div><div className="mt-7 border-t border-border pt-6"><div className="mono-font mb-3 text-[10px] font-bold uppercase tracking-wider text-primary">Owner details</div><div className="grid gap-4 sm:grid-cols-2">{textField('ownerName', 'Owner name', 'Registered owner')}{textField('ownerPhone', 'Owner phone', '+91 98765 43210', 'tel')}{textField('ownerEmail', 'Owner email', 'owner@company.com', 'email')}</div></div><div className="mt-7 border-t border-border pt-6"><div className="mono-font mb-3 text-[10px] font-bold uppercase tracking-wider text-primary">Operator details</div><div className="grid gap-4 sm:grid-cols-2">{textField('operatorName', 'Operator name', 'Full name')}{textField('operatorPhone', 'Operator number', '+91 98765 43210', 'tel')}{textField('operatorExperience', 'Operator experience', 'e.g. 8 years')}</div></div><div className="mt-6 grid gap-3 border-l-2 border-primary bg-primary/5 p-4 text-xs leading-5 text-muted-foreground"><label className="flex items-center gap-3 font-semibold text-foreground"><input required type="checkbox" checked={form.sensorsWorking} onChange={(e) => update('sensorsWorking', e.target.checked)} className="h-4 w-4 accent-[hsl(var(--primary))]" /> All vehicle sensors are working *</label><span className="flex items-center gap-3"><Radio size={16} className="shrink-0 text-primary" />ECU telemetry will use these meter readings and show live sensor status after listing.</span></div><button className="mt-6 flex h-11 w-full items-center justify-center gap-2 bg-primary text-xs font-bold text-primary-foreground"><PackagePlus size={15} /> PUBLISH LISTING</button></form></OwnerShell>;
}

function AdminShell({ children }: { children: ReactNode }) {
  return <PageFrame><div className="grid lg:grid-cols-[240px_1fr]"><aside className="border-b border-border bg-card p-5 lg:min-h-[calc(100dvh-72px)] lg:border-b-0 lg:border-r lg:p-6"><div className="mono-font text-[10px] uppercase tracking-wider text-primary">Admin console</div><h2 className="display-font mt-2 text-3xl font-bold uppercase">Control room</h2><nav className="mt-7 grid gap-1">{[['/admin', 'Overview', LayoutDashboard], ['/admin/users', 'Users', Users], ['/admin/bookings', 'Bookings', ReceiptText], ['/admin/payments', 'Payments', CreditCard], ['/fleet', 'All fleet monitoring', Radio], ['/admin/sensors', 'ECU sensors', Gauge], ['/admin/notifications', 'Notifications', Bell]].map(([href, label, Icon]) => <Link key={href as string} href={href as string} className="flex items-center gap-3 px-3 py-3 text-xs font-semibold text-muted-foreground hover:bg-primary/10 hover:text-primary">{typeof Icon === 'function' ? <Icon size={15} /> : null}{label as string}</Link>)}</nav></aside><section className="min-w-0 px-5 py-10 lg:px-10 lg:py-14">{children}</section></div></PageFrame>;
}

function AdminOverviewPage() {
  const { equipment, bookings, notifications } = useAppState();
  const local = useContext(LocalAuthContext);
  const cards = [[String(local?.accounts.length ?? 0), 'Users', Users], [String(bookings.length), 'Total bookings', ReceiptText], [String(equipment.length), 'Active assets', Truck], [String(notifications.length), 'Notification events', Bell]] as const;
  return <AdminShell><SectionLabel eyebrow="Admin / overview" title="Marketplace control room." body="Counts and activity shown here come only from currently available application data." /><div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">{cards.map(([value, label, Icon]) => <div key={label} className="border border-border bg-card p-5"><div className="flex items-center justify-between"><span className="mono-font text-2xl font-bold text-primary">{value}</span><Icon size={17} className="text-primary" /></div><div className="mt-2 text-xs text-muted-foreground">{label}</div></div>)}</div><div className="mt-8 border border-border bg-card p-5"><h3 className="text-sm font-bold">Recent activity</h3>{notifications.length === 0 ? <p className="mt-4 text-xs text-muted-foreground">No activity has been recorded.</p> : <div className="mt-4 grid gap-3">{notifications.slice(0, 4).map((item) => <div key={item.id} className="flex gap-3 border-b border-border p-5 last:border-0 last:pb-0"><Activity size={14} className="mt-0.5 text-primary" /><div><b>{item.title}</b><div className="mt-1 text-muted-foreground">{item.time}</div></div></div>)}</div>}</div></AdminShell>;
}

function AdminUsersPage() {
  const local = useContext(LocalAuthContext);
  return <AdminShell><SectionLabel eyebrow="Admin / users" title="Users and roles." body="Only accounts currently available in this workspace are shown." /><div className="overflow-x-auto border border-border bg-card">{local?.accounts.length ? <table className="w-full min-w-[640px] text-left text-xs"><thead className="border-b border-border text-[10px] uppercase tracking-wider text-muted-foreground"><tr><th className="p-4">User</th><th className="p-4">Role</th><th className="p-4">Status</th></tr></thead><tbody>{local.accounts.map((account) => <tr key={account.primaryEmailAddress.emailAddress} className="border-b border-border last:border-0"><td className="p-4 font-semibold">{account.fullName}<div className="mt-1 text-muted-foreground">{account.primaryEmailAddress.emailAddress}</div></td><td className="p-4 text-muted-foreground">{account.role}</td><td className="p-4 text-emerald-400">Available</td></tr>)}</tbody></table> : <p className="p-8 text-center text-xs text-muted-foreground">No user accounts are available.</p>}</div></AdminShell>;
}

function AdminBookingsPage() {
  const { bookings } = useAppState();
  return <AdminShell><SectionLabel eyebrow="Admin / bookings" title="Booking states." body="Payment confirmation and booking confirmation remain separate operational events." /><div className="grid gap-3">{bookings.length ? bookings.map((booking) => <div key={booking.id} className="flex flex-col justify-between gap-4 border border-border bg-card p-5 sm:flex-row sm:items-center"><div><div className="mono-font text-[10px] text-primary">{booking.id}</div><h3 className="mt-2 font-bold">{booking.equipmentName}</h3><div className="mt-1 text-xs text-muted-foreground">{booking.location}</div></div><div className="flex flex-wrap gap-2 text-[10px] font-bold uppercase"><span className="border border-emerald-400/30 bg-emerald-400/10 px-2 py-1 text-emerald-400">Payment {booking.paymentStatus}</span><span className="border border-primary/30 bg-primary/10 px-2 py-1 text-primary">{booking.status.replace('-', ' ')}</span><span className="px-2 py-1 text-primary">₹{fmt(booking.total)}</span></div></div>) : <p className="border border-dashed border-border p-8 text-center text-xs text-muted-foreground">No bookings are available.</p>}</div></AdminShell>;
}

function AdminPaymentsPage() {
  const { bookings } = useAppState();
  const rows = bookings;
  return <AdminShell><SectionLabel eyebrow="Admin / payments" title="Payment operations." body="Review captured, pending, and refunded payment states alongside every booking." /><div className="overflow-x-auto border border-border bg-card">{rows.length ? <table className="w-full min-w-[760px] text-left text-xs"><thead className="border-b border-border text-[10px] uppercase tracking-wider text-muted-foreground"><tr><th className="p-4">Booking</th><th className="p-4">Method</th><th className="p-4">Booking state</th><th className="p-4">Payment state</th><th className="p-4 text-right">Amount</th></tr></thead><tbody>{rows.map((booking) => <tr key={booking.id} className="border-b border-border last:border-0"><td className="p-4"><b>{booking.id}</b><div className="mt-1 text-muted-foreground">{booking.equipmentName}</div></td><td className="p-4 text-muted-foreground">{booking.paymentMethod}</td><td className="p-4">{booking.status.replace('-', ' ')}</td><td className={`p-4 font-bold ${booking.paymentStatus === 'refunded' ? 'text-sky-300' : booking.paymentStatus === 'paid' ? 'text-emerald-400' : 'text-primary'}`}>{booking.paymentStatus}</td><td className="p-4 text-right font-bold text-primary">₹{fmt(booking.total)}</td></tr>)}</tbody></table> : <p className="p-8 text-center text-xs text-muted-foreground">No payment records are available.</p>}</div></AdminShell>;
}

function AdminSensorsPage() {
  const { equipment, sensors } = useAppState();
  return <AdminShell><SectionLabel eyebrow="Admin / sensors" title="ECU feed health." body="All machine telemetry is visible here: GPS, engine, fuel, electrical, hydraulic, fluid, odometer, and work-session readings." /><div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{equipment.map((item) => { const sensor = { ...defaultSensor,
    ...(sensors[item.id] ?? {}),
  };
  const readings = [['GPS latitude', `${sensor.latitude.toFixed(5)}°`], ['GPS longitude', `${sensor.longitude.toFixed(5)}°`], ['Speed', `${sensor.speedKph} km/h`], ['Odometer', `${sensor.odometerKm.toLocaleString('en-IN')} km`], ['Engine temperature', `${sensor.temperature} °C`], ['Engine RPM', `${sensor.engineRpm}`], ['Engine load', `${sensor.engineLoad}%`], ['Hydraulic pressure', `${sensor.hydraulicPressure} bar`], ['Work hours', `${sensor.workHours} h`], ['Fuel level', `${sensor.fuel}%`], ['Fuel rate', `${sensor.fuelRate} L/h`], ['Battery voltage', `${sensor.batteryVoltage} V`], ['Oil pressure', `${sensor.oilPressure} bar`], ['Coolant level', `${sensor.coolantLevel}%`], ['Distance today', `${sensor.kmDriven} km`], ['Engine state', sensor.engineStatus], ['Last ECU sync', sensor.lastSync]];
  return <article key={item.id} className="border border-border bg-card p-5"><div className="flex items-start justify-between"><div><div className="mono-font text-[10px] text-primary">{item.type} · {item.city}</div><h3 className="mt-2 font-bold">{item.name}</h3><div className="mt-1 text-[10px] text-muted-foreground">Vehicle {item.id.toUpperCase()} · ECU connected</div></div><span className="flex items-center gap-2 text-[10px] text-emerald-400"><span className="h-2 w-2 animate-pulse rounded-full bg-emerald-400" />Live</span></div><div className="mt-5 grid grid-cols-2 gap-2 text-xs">{readings.map(([label, value]) => <div key={label} className="border border-border p-3"><div className="text-[10px] text-muted-foreground">{label}</div><div className="mono-font mt-2 font-bold text-primary">{value}</div></div>)}</div></article>; })}</div></AdminShell>;
}

function AdminNotificationsPage() {
  const { notifications } = useAppState();
  return <AdminShell><SectionLabel eyebrow="Admin / notifications" title="Dispatcher log." body="A central feed for booking, payment, location, and operation events." /><div className="border border-border bg-card">{notifications.length ? notifications.map((item) => <div key={item.id} className="flex gap-4 border-b border-border p-5 last:border-0"><Bell size={15} className="mt-1 text-primary" /><div><div className="text-sm font-bold">{item.title}</div><div className="mt-1 text-xs text-muted-foreground">{item.body}</div></div><span className="ml-auto text-[10px] text-muted-foreground">{item.time}</span></div>) : <p className="p-8 text-center text-xs text-muted-foreground">No notification events are available.</p>}</div></AdminShell>;
}

function SignOutButton({ compact = false }: { compact?: boolean }) {
  const { signOut } = useWorkspaceClerk();
  const logout = () => {
    if (localDemoMode) {
      signOut();
      window.location.href = `${basePath}/sign-in`;
      return;
    }
    signOut({ redirectUrl: basePath || '/' });
  };
  return <button onClick={logout} className={`flex items-center gap-2 text-xs font-bold text-muted-foreground hover:border-primary hover:text-primary ${compact ? 'h-9 border border-border px-3' : 'py-4'}`}><LogOut size={14} /> Sign out</button>;
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
  const auth = useWorkspaceAuth();
  const [location] = useLocation();
  if (localDemoMode && !auth.isSignedIn && !location.startsWith('/sign-in') && !location.startsWith('/sign-up') && !location.startsWith('/admin/login')) return <Redirect to="/sign-in" />;
  return <Switch><Route path="/" component={HomePage} /><Route path="/sign-in/*?" component={() => <AuthPage mode="sign-in" />} /><Route path="/sign-up/*?" component={() => <AuthPage mode="sign-up" />} /><Route path="/admin/login" component={AdminLoginPage} /><Route path="/browse" component={BrowsePage} /><Route path="/how-it-works" component={HowItWorksPage} /><Route path="/booking/:id" component={() => <ProtectedPage><BookingPage /></ProtectedPage>} /><Route path="/bookings" component={() => <ProtectedPage><BookingsPage /></ProtectedPage>} /><Route path="/notifications" component={() => <ProtectedPage><NotificationsPage /></ProtectedPage>} /><Route path="/profile" component={() => <ProtectedPage><ProfilePage /></ProtectedPage>} /><Route path="/favorites" component={() => <ProtectedPage><FavoritesPage /></ProtectedPage>} /><Route path="/fleet" component={() => <OwnerOrAdmin><FleetPage /></OwnerOrAdmin>} /><Route path="/owner/dashboard" component={() => <OwnerOrAdmin><OwnerDashboardPage /></OwnerOrAdmin>} /><Route path="/owner/listings" component={() => <OwnerOrAdmin><OwnerListingsPage /></OwnerOrAdmin>} /><Route path="/owner/listings/new" component={() => <OwnerOrAdmin><NewListingPage /></OwnerOrAdmin>} /><Route path="/admin" component={() => <AdminOnly><AdminOverviewPage /></AdminOnly>} /><Route path="/admin/users" component={() => <AdminOnly><AdminUsersPage /></AdminOnly>} /><Route path="/admin/bookings" component={() => <AdminOnly><AdminBookingsPage /></AdminOnly>} /><Route path="/admin/payments" component={() => <AdminOnly><AdminPaymentsPage /></AdminOnly>} /><Route path="/admin/sensors" component={() => <AdminOnly><AdminSensorsPage /></AdminOnly>} /><Route path="/admin/notifications" component={() => <AdminOnly><AdminNotificationsPage /></AdminOnly>} /><Route component={NotFound} /></Switch>;
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
  if (localDemoMode) {
    return <LocalAuthProvider><AppStateProvider><Router /></AppStateProvider></LocalAuthProvider>;
  }
  return <ClerkProvider publishableKey={clerkPubKey} proxyUrl={clerkProxyUrl} appearance={clerkAppearance} signInUrl={`${basePath}/sign-in`} signUpUrl={`${basePath}/sign-up`} localization={{ signIn: { start: { title: 'Welcome back', subtitle: 'Sign in to access your account' } }, signUp: { start: { title: 'Create your account', subtitle: 'Start booking with confidence' } } }} routerPush={(to) => setLocation(stripBase(to))} routerReplace={(to) => setLocation(stripBase(to))}><AppStateProvider><Router /></AppStateProvider></ClerkProvider>;
}

function App() {
  return <WouterRouter base={basePath}><ClerkProviderWithRoutes /></WouterRouter>;
}

export default App;

