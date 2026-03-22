"use client";

import { useCallback, useEffect, useState, useRef } from "react";
import { createBrowserClient } from "@supabase/ssr";
import { Pencil, User } from "lucide-react";
import toast from "react-hot-toast";
import ProfileSafetyPanel from "@/components/ProfileSafetyPanel";
import CampusDashboard from "@/components/CampusDashboard";
import CollegePicker from "@/components/CollegePicker";
import { useTheme } from "@/hooks/useTheme";
import { CampusEmotionResponse, College } from "@/lib/types";
import SmileScoreSurvey from "@/components/SmileScoreSurvey";
import StripeCheckout from "@/components/StripeCheckout";
import { AVATARS } from "@/lib/avatars";
import { emergencyContactSchema, profileUpdateSchema } from "@/lib/profileValidation";

type ProfileData = {
    id?: string;
    display_name?: string | null;
    avatar_url?: string | null;
    unique_code?: string | null;
    hobbies?: string | null;
    favorite_movies?: string | null;
    favorite_music?: string | null;
    other_details?: string | null;
    impulse_shield_active?: boolean | null;
    anonymous_mode?: boolean | null;
    share_mood?: boolean | null;
    mood_visibility?: "friends" | "nobody" | "everyone" | null;
    college_id?: string | null;
    city?: string | null;
    major?: string | null;
    grade?: string | null;
};

type ContactRecord = {
    id: string;
    name: string;
    phone: string;
    relationship?: string | null;
};

type JournalEntry = {
    created_at: string;
    mood?: string | null;
};

type CampusPeer = {
    id: string;
    unique_code?: string | null;
};

export default function ProfilePage() {
    const supabase = createBrowserClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );

    const [profile, setProfile] = useState<ProfileData | null>(null);
    const [contacts, setContacts] = useState<ContactRecord[]>([]);
    const [journalEntries, setJournalEntries] = useState<JournalEntry[]>([]);
    const [college, setCollege] = useState<College | null>(null);
    const [campusInsights, setCampusInsights] = useState<CampusEmotionResponse | null>(null);
    const [isCampusLoading, setIsCampusLoading] = useState(false);
    const [journalCount, setJournalCount] = useState(0);
    const [checkInCount, setCheckInCount] = useState(0);
    const [isLoading, setIsLoading] = useState(true);
    const [userEmail, setUserEmail] = useState<string>("Loading...");
    const [showAvatars, setShowAvatars] = useState(false);
    const [displayName, setDisplayName] = useState("");
    const [savingUsername, setSavingUsername] = useState(false);
    const [shieldActive, setShieldActive] = useState(false);
    const [campusPeers, setCampusPeers] = useState<CampusPeer[]>([]);
    const { theme, setTheme } = useTheme();
    const [campusAffiliation, setCampusAffiliation] = useState<string | null>(null);
    const [isCanvasLinked, setIsCanvasLinked] = useState(false);
    const [canvasSyncStatus, setCanvasSyncStatus] = useState("Connect LMS");
    const [isPremium] = useState(false);
    const [showCheckout, setShowCheckout] = useState(false);
    const [demoMoodScore, setDemoMoodScore] = useState(50); 
    const [isCapOneLinked, setIsCapOneLinked] = useState(false);
    const [capOneMiles, setCapOneMiles] = useState(0);
    const [showCapOneModal, setShowCapOneModal] = useState(false);
    const [isAuthenticating, setIsAuthenticating] = useState(false);

    // Load the miles when the profile page opens
    useEffect(() => {
        const savedMiles = parseInt(localStorage.getItem('aura_capOneMiles') || '0');
        setCapOneMiles(savedMiles);
    }, []);
    
    // Add this to store our timeouts!
    const timeoutRefs = useRef<NodeJS.Timeout[]>([]);

    // Fake Assignments Data
    const assignments = [
        { id: 1, title: "Data Structures Midterm", course: "CIS 2168", due: "Tomorrow", stress: "High", color: "text-red-400", bg: "bg-red-500/10" },
        { id: 2, title: "UX Case Study Draft", course: "DES 3100", due: "In 3 Days", stress: "Medium", color: "text-orange-400", bg: "bg-orange-500/10" },
        { id: 3, title: "Weekly Reflection", course: "PSY 1001", due: "Friday", stress: "Low", color: "text-green-400", bg: "bg-green-500/10" }
    ];

    // Original AI Logic 
    const getAIFeedback = (score: number) => {
        if (score >= 75) return "✨ Aura AI: You are in a peak flow state today! Your cognitive load capacity is high. We recommend tackling the High-Stress 'Data Structures Midterm' prep right now to maximize your focus.";
        if (score >= 40) return "✨ Aura AI: You're maintaining a balanced headspace. Don't burn out—focus on moderate tasks like your 'UX Case Study Draft'. Break it into 30-minute Pomodoro sessions.";
        return "✨ Aura AI: Warning: Your emotional bandwidth is critically low today. Pushing through heavy studying will cause burnout. Just submit the low-stress 'Weekly Reflection' to keep your grades up, then take the rest of the night off. The midterm can wait until you recover.";
    };

    const handleCanvasConnect = () => {
        setCanvasSyncStatus("Authenticating SSO...");
        
        // Store the timeouts so we can cancel them if needed
        const t1 = setTimeout(() => setCanvasSyncStatus("Fetching Tasks..."), 800);
        const t2 = setTimeout(() => setCanvasSyncStatus("Running Aura AI..."), 1600);
        const t3 = setTimeout(() => {
            setIsCanvasLinked(true);
            setCanvasSyncStatus("Synced ✓");
        }, 2400);

        timeoutRefs.current = [t1, t2, t3];
    };

    const handleCanvasDisconnect = () => {
        // KILL ALL TIMEOUTS INSTANTLY so the browser doesn't glitch!
        timeoutRefs.current.forEach(clearTimeout);
        timeoutRefs.current = [];

        setIsCanvasLinked(false);
        setCanvasSyncStatus("Connect LMS");
        setDemoMoodScore(50);
    };



    const fetchProfileData = useCallback(async () => {
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return;

            setUserEmail(user.email || "No email available");

            const profileResponse = await fetch("/api/profile", { cache: "no-store" });
            if (!profileResponse.ok) {
                throw new Error("Unable to load profile.");
            }
            const profilePayload = await profileResponse.json();
            const profileData = profilePayload.profile ?? null;
            const contactsData = profilePayload.contacts ?? [];

            // Fetch journal entries
            const { data: journalData } = await supabase
                .from('journal_entries')
                .select('*')
                .eq('user_id', user.id)
                .order('created_at', { ascending: false });

            let collegeData: College | null = null;
            if (profileData?.college_id) {
                const { data: selectedCollege } = await supabase
                    .from('colleges')
                    .select('id, name, city, latitude, longitude, campus_radius')
                    .eq('id', profileData.college_id)
                    .single();
                collegeData = (selectedCollege as College) ?? null;
            }

            setProfile(profileData);
            setContacts(contactsData || []);
            setJournalEntries(journalData || []);
            setCollege(collegeData);
            setCheckInCount(profilePayload.checkinCount || 0);
            setJournalCount(profilePayload.journalCount || 0);
            setDisplayName(profileData?.display_name || "");
            setShieldActive(profileData?.impulse_shield_active || false);
            setCampusAffiliation(collegeData?.name ?? null);
        } catch (err) {
            console.error("Error loading profile:", err);
            toast.error("Could not load your profile.");
        } finally {
            setIsLoading(false);
        }
    }, [supabase]);

    useEffect(() => {
        fetchProfileData();
    }, [fetchProfileData]);

    useEffect(() => {
        if (!college?.id) {
            setCampusInsights(null);
            return;
        }

        let isMounted = true;
        setIsCampusLoading(true);

        fetch(`/api/campus/${encodeURIComponent(college.id)}/emotions`)
            .then(async (response) => {
                if (!response.ok) {
                    throw new Error("Unable to load campus insights.");
                }
                const payload = await response.json();
                if (!isMounted) {
                    return;
                }
                setCampusInsights(payload as CampusEmotionResponse);
            })
            .catch((error) => {
                console.error(error);
                if (isMounted) {
                    setCampusInsights(null);
                }
            })
            .finally(() => {
                if (isMounted) {
                    setIsCampusLoading(false);
                }
            });

        // Fetch peers right after
        if (profile?.id) {
            fetch(`/api/campus/${encodeURIComponent(college.id)}/peers?userId=${profile.id}`)
                .then(res => res.json())
                .then(data => {
                    if (isMounted && data.peers) setCampusPeers(data.peers);
                })
                .catch(err => console.error("Error fetching peers:", err));
        }

        return () => {
            isMounted = false;
        };
    }, [college?.id, profile?.id]);

    async function handleUpdateProfile(updates: Record<string, unknown>) {
        try {
            const parsed = profileUpdateSchema.safeParse(updates);
            if (!parsed.success) {
                toast.error(parsed.error.issues[0]?.message ?? "Invalid profile data.");
                return null;
            }

            const response = await fetch("/api/profile", {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(parsed.data),
            });

            if (!response.ok) {
                const payload = await response.json().catch(() => ({}));
                throw new Error(payload.error || "Unable to save profile.");
            }

            const nextProfile = { ...profile, ...parsed.data };
            setProfile(nextProfile);
            return nextProfile;
        } catch (err) {
            console.error("Error updating profile:", err);
            toast.error(err instanceof Error ? err.message : "Unable to save profile.");
            return null;
        }
    }

    async function handleSaveDisplayName() {
        const trimmedName = displayName.trim();
        if (!trimmedName) {
            toast.error("Display name is required.");
            return;
        }
        setSavingUsername(true);
        const updated = await handleUpdateProfile({ display_name: trimmedName });
        if (updated) {
            setDisplayName(trimmedName);
            toast.success("Display name updated.");
        }
        setSavingUsername(false);
    }

    async function handleAvatarSelect(url: string) {
        setShowAvatars(false);
        await handleUpdateProfile({ avatar_url: url });
    }

    async function handleAddContact(contact?: { name: string; phone: string; relationship: string }) {
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return;
            const parsed = emergencyContactSchema.safeParse(contact ?? {});
            if (!parsed.success) {
                toast.error(parsed.error.issues[0]?.message ?? "Invalid contact.");
                return;
            }
            const { name, phone, relationship } = parsed.data;

            const { data: newContact, error } = await supabase
                .from('emergency_contacts')
                .insert({ user_id: user.id, name, phone, relationship })
                .select()
                .single();

            if (error) throw error;

            setContacts((prev) => [newContact, ...prev]);
            toast.success("Emergency contact added.");
        } catch (err) {
            console.error("Error adding contact:", err);
            toast.error("Failed to save contact.");
        }
    }

    async function handleDeleteContact(id: string) {
        try {
            const { error } = await supabase
                .from("emergency_contacts")
                .delete()
                .eq("id", id);

            if (error) throw error;

            setContacts((prev) => prev.filter((c) => c.id !== id));
            toast.success("Emergency contact removed.");
        } catch (err) {
            console.error("Error deleting contact:", err);
            toast.error("Unable to remove contact.");
        }
    }

    async function handleExportData() {
        try {
            const exportObj = {
                profile,
                contacts,
                journal_entries: journalEntries,
                exportedAt: new Date().toISOString()
            };

            const blob = new Blob([JSON.stringify(exportObj, null, 2)], { type: "application/json" });
            const url = URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url;
            a.download = `aura-atlas-profile-export.json`;
            a.click();
            URL.revokeObjectURL(url);
        } catch (err) {
            console.error("Export error:", err);
        }
    }

    async function handleDeleteAllJournal() {
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return;

            if (!window.confirm("Are you sure? This cannot be undone.")) return;

            const { error } = await supabase
                .from('journal_entries')
                .delete()
                .eq('user_id', user.id);

            if (error) throw error;

            setJournalEntries([]);
            setJournalCount(0);
            toast.success("All journal entries deleted.");
        } catch (err) {
            console.error("Delete error:", err);
        }
    }

    async function handleToggleShield() {
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return;

            const newValue = !shieldActive;
            setShieldActive(newValue);

            await supabase
                .from('profiles')
                .update({ impulse_shield_active: newValue })
                .eq('id', user.id);

            setProfile((prev) => ({ ...(prev ?? {}), impulse_shield_active: newValue }));
        } catch (err) {
            console.error("Shield toggle error:", err);
        }
    }

    const handleRecoveryUnlock = async () => {
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return;

            setShieldActive(false);
            await supabase.from('profiles').update({ impulse_shield_active: false }).eq('id', user.id);
            setProfile((prev) => ({ ...(prev ?? {}), impulse_shield_active: false }));
            toast.success("Account unlocked. We are so glad you are feeling better!");
        } catch (err) {
            console.error("Unlock error:", err);
        }
    };

    async function handleCollegeSave(collegeId: string | null, city: string, major: string | null, grade: string | null) {
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) {
                console.error("No user found in handleCollegeSave");
                return;
            }

            const updates: Record<string, unknown> = { 
                college_id: collegeId, 
                city, 
                major: major ?? null, 
                grade: grade ?? null 
            };

            // 🛡️ Added .select().single() to force Supabase to return the row.
            // If RLS blocks the update, this will now throw a catchable error.
            const { data: updatedProfile, error } = await supabase
                .from("profiles")
                .update(updates)
                .eq("id", user.id)
                .select()
                .single();

            if (error) {
                console.error("Supabase Save Error:", error.message, error.details);
                throw new Error(error.message);
            }

            // 🔄 Instantly sync local profile state
            setProfile(updatedProfile);

            if (collegeId) {
                const { data: selectedCollege, error: collegeError } = await supabase
                    .from("colleges")
                    .select("id, name, city, latitude, longitude, campus_radius")
                    .eq("id", collegeId)
                    .single();
                
                if (collegeError) {
                    console.error("Error fetching college details:", collegeError.message);
                }
                setCollege((selectedCollege as College) ?? null);
            } else {
                setCollege(null);
                setCampusInsights(null);
            }
        } catch (err: unknown) {
            const message = err instanceof Error ? err.message : String(err);
            console.error("Failed to save college in ProfilePage:", message);
            throw err; // Re-throw to be caught by CollegePicker's catch block
        }
    }
    async function handleLogout() {

        await supabase.auth.signOut();
        window.location.href = "/login";
    }

    async function handleAddCampusPeer(uniqueCode?: string) {
        if (!uniqueCode) {
            toast.error("This campus peer is missing a friend code.");
            return;
        }

        try {
            const response = await fetch("/api/friends", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ username: uniqueCode }),
            });

            const payload = await response.json().catch(() => ({}));
            if (!response.ok) {
                throw new Error(payload.error || "Unable to send friend request.");
            }

            toast.success(`Friend request sent to #${uniqueCode}.`);
        } catch (error) {
            const message = error instanceof Error ? error.message : "Unable to send friend request.";
            toast.error(message);
        }
    }

    if (isLoading) {
        return (
            <div className="min-h-screen bg-[var(--background)] flex items-center justify-center">
                <div className="h-10 w-10 border-4 border-teal-500/30 border-t-teal-500 rounded-full animate-spin" />
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-[var(--background)] page-enter pb-20">
            <div className="mx-auto max-w-4xl px-4 pt-12">
                <header className="mb-10 text-center py-10 px-6">
                    <h1 className="text-3xl font-semibold tracking-tight text-[var(--foreground)] mb-3">
                        Profile & Settings
                    </h1>
                    <p className="text-sm text-[var(--muted-text)] max-w-xl mx-auto">
                        Manage your workspace, emergency contacts, and campus integration.
                    </p>
                </header>

                <div className="mb-8 grid gap-8 md:grid-cols-1">
                    <div className="app-surface p-6 rounded-3xl border border-[var(--border-soft)]">
                        <div className="flex items-center justify-between mb-2">
                            <h2 className="text-xl font-bold text-[var(--foreground)]">Theme Preference</h2>
                            <div className="flex bg-[var(--background)] p-1 rounded-xl">
                                <button
                                    onClick={() => setTheme("dark")}
                                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${theme === "dark" ? "bg-teal-600 text-white" : "text-[var(--muted-text)]"}`}
                                >
                                    Dark
                                </button>
                                <button
                                    onClick={() => setTheme("light")}
                                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${theme === "light" ? "bg-teal-600 text-white" : "text-[var(--muted-text)]"}`}
                                >
                                    Light
                                </button>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="mb-10 app-surface p-8 rounded-3xl border border-[var(--border-soft)] relative">

                    <div className="flex flex-col md:flex-row items-center gap-8 relative z-10">
                        <div className="relative">
                            <div
                                onClick={() => setShowAvatars(!showAvatars)}
                                className="h-24 w-24 rounded-full bg-[var(--background)] p-1 ring-2 ring-[var(--border-soft)] overflow-hidden cursor-pointer hover:ring-teal-500/40 transition-all"
                            >
                                {profile?.avatar_url ? (
                                    <img src={profile.avatar_url} alt="Profile avatar" className="w-full h-full object-cover rounded-full" />
                                ) : (
                                    <div className="h-full w-full flex items-center justify-center text-[var(--foreground-muted)]">
                                        <User className="h-10 w-10" />
                                    </div>
                                )}
                            </div>
                            <button
                                onClick={() => setShowAvatars(!showAvatars)}
                                aria-label="Choose profile avatar"
                                className="absolute bottom-0 right-0 h-8 w-8 rounded-full bg-teal-600 flex items-center justify-center text-sm hover:bg-teal-500 transition-colors border-3 border-[var(--surface-1)]"
                            >
                                <Pencil className="h-4 w-4" />
                            </button>
                        </div>

                        <div className="flex-1 text-center md:text-left">
                            <div className="flex flex-col sm:flex-row items-center gap-3 mb-2">
                                <input
                                    aria-label="Display name"
                                    type="text"
                                    value={displayName}
                                    onChange={(e) => setDisplayName(e.target.value)}
                                    placeholder="Add your name..."
                                    className="text-3xl font-bold bg-transparent text-[var(--foreground)] placeholder-[var(--foreground-muted)] focus:outline-none w-full max-w-xs text-center md:text-left"
                                />
                                {displayName !== profile?.display_name && (
                                    <button
                                        onClick={handleSaveDisplayName}
                                        disabled={savingUsername}
                                        className="px-4 py-1.5 text-xs font-bold rounded-xl bg-teal-500 text-white hover:bg-teal-600 transition-colors shadow-sm disabled:opacity-50"
                                    >
                                        {savingUsername ? "Saving..." : "Save Name"}
                                    </button>
                                )}
                            </div>
                            <div className="text-[var(--muted-text)] font-medium mb-3 flex items-center justify-center md:justify-start gap-2">
                                <span className="h-2 w-2 rounded-full bg-teal-500" />
                                {userEmail}
                            </div>
                            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-[var(--surface-2)] text-xs font-mono text-[var(--muted-text)] border border-[var(--border-soft)]">
                                {profile?.unique_code || "—"}
                            </div>
                        </div>

                        <div className="flex gap-4">
                            <div className="text-center px-6 py-3 rounded-2xl bg-[var(--surface-2)] border border-[var(--border-soft)]">
                                <div className="text-2xl font-semibold text-[var(--foreground)]">{isLoading ? ".." : checkInCount}</div>
                                <div className="text-[10px] font-medium text-[var(--muted-text)] uppercase tracking-wider">Check-ins</div>
                            </div>
                            <div className="text-center px-6 py-3 rounded-2xl bg-[var(--surface-2)] border border-[var(--border-soft)]">
                                <div className="text-2xl font-semibold text-[var(--foreground)]">{isLoading ? ".." : journalCount}</div>
                                <div className="text-[10px] font-medium text-[var(--muted-text)] uppercase tracking-wider">Journals</div>
                            </div>
                        </div>
                    </div>

                    {showAvatars && (
                        <div className="mt-4 grid grid-cols-4 sm:grid-cols-8 gap-2 rounded-2xl border border-white/[0.06] bg-white/[0.02] p-3 animate-in zoom-in-95 duration-200">
                            {AVATARS.map((url, i) => (
                                <button
                                    key={i}
                                    onClick={() => handleAvatarSelect(url)}
                                    type="button"
                                    aria-label={`Select avatar ${i + 1}`}
                                    aria-pressed={profile?.avatar_url === url}
                                    className={`aspect-square rounded-xl overflow-hidden cursor-pointer hover:ring-2 ring-teal-400 transition-all focus:outline-none focus:ring-2 focus:ring-teal-400 ${profile?.avatar_url === url ? "ring-2 ring-teal-500" : ""
                                        }`}
                                >
                                    <img src={url} alt={`Avatar ${i + 1}`} className="w-full h-full object-cover bg-slate-800" />
                                </button>
                            ))}
                        </div>
                    )}
                </div>

                <ProfileSafetyPanel
                    profile={profile || {}}
                    contacts={contacts}
                    journalEntries={journalEntries}
                    shieldActive={shieldActive}
                    capOneMiles={capOneMiles}
                    setCapOneMiles={setCapOneMiles}
                    isCapOneLinked={isCapOneLinked}
                    setIsCapOneLinked={setIsCapOneLinked}
                    setShowCapOneModal={setShowCapOneModal}
                    onUpdateProfile={handleUpdateProfile}
                    onToggleShield={handleToggleShield}
                    onRecoveryUnlock={handleRecoveryUnlock}
                    onAddContact={handleAddContact}
                    onDeleteContact={handleDeleteContact}
                    onExportData={handleExportData}
                    onDeleteAllJournal={handleDeleteAllJournal}
                />

                <div className="mt-8 app-surface rounded-3xl border border-[var(--border-soft)] p-6">
                    <div className="mb-6 flex items-center justify-between gap-4">
                        <div>
                            <h2 className="text-xl font-bold text-[var(--foreground)]">Profile Details</h2>
                            <p className="text-sm text-[var(--muted-text)]">Tighten the basics people actually use: who you are, what you enjoy, and what helps.</p>
                        </div>
                    </div>
                    <div className="grid gap-4 md:grid-cols-2">
                        <label className="flex flex-col gap-2 md:col-span-2">
                            <span className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--muted-text)]">About You</span>
                            <textarea
                                aria-label="About you"
                                value={profile?.hobbies || ""}
                                onChange={(e) => setProfile((prev) => ({ ...(prev ?? {}), hobbies: e.target.value }))}
                                className="min-h-28 rounded-2xl border border-[var(--border-soft)] bg-[var(--surface-2)] px-4 py-3 text-sm text-[var(--foreground)] outline-none transition focus:border-teal-500/50"
                                placeholder="A short intro, your energy, and the things you care about."
                            />
                        </label>
                        <label className="flex flex-col gap-2">
                            <span className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--muted-text)]">Favorite Movies</span>
                            <textarea
                                aria-label="Favorite movies"
                                value={profile?.favorite_movies || ""}
                                onChange={(e) => setProfile((prev) => ({ ...(prev ?? {}), favorite_movies: e.target.value }))}
                                className="min-h-24 rounded-2xl border border-[var(--border-soft)] bg-[var(--surface-2)] px-4 py-3 text-sm text-[var(--foreground)] outline-none transition focus:border-teal-500/50"
                                placeholder="The films you keep returning to."
                            />
                        </label>
                        <label className="flex flex-col gap-2">
                            <span className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--muted-text)]">Favorite Music</span>
                            <textarea
                                aria-label="Favorite music"
                                value={profile?.favorite_music || ""}
                                onChange={(e) => setProfile((prev) => ({ ...(prev ?? {}), favorite_music: e.target.value }))}
                                className="min-h-24 rounded-2xl border border-[var(--border-soft)] bg-[var(--surface-2)] px-4 py-3 text-sm text-[var(--foreground)] outline-none transition focus:border-teal-500/50"
                                placeholder="Artists, albums, playlists, or moods."
                            />
                        </label>
                        <label className="flex flex-col gap-2 md:col-span-2">
                            <span className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--muted-text)]">Support Notes</span>
                            <textarea
                                aria-label="Support notes"
                                value={profile?.other_details || ""}
                                onChange={(e) => setProfile((prev) => ({ ...(prev ?? {}), other_details: e.target.value }))}
                                className="min-h-28 rounded-2xl border border-[var(--border-soft)] bg-[var(--surface-2)] px-4 py-3 text-sm text-[var(--foreground)] outline-none transition focus:border-teal-500/50"
                                placeholder="What helps you feel safe, focused, and supported?"
                            />
                        </label>
                    </div>
                    <div className="mt-4 flex justify-end">
                        <button
                            type="button"
                            onClick={async () => {
                                const updated = await handleUpdateProfile({
                                    hobbies: profile?.hobbies || "",
                                    favorite_movies: profile?.favorite_movies || "",
                                    favorite_music: profile?.favorite_music || "",
                                    other_details: profile?.other_details || "",
                                });
                                if (updated) toast.success("Profile details saved.");
                            }}
                            className="rounded-2xl bg-teal-500 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-teal-600"
                        >
                            Save Details
                        </button>
                    </div>
                </div>

                <div className="mt-6 mb-6">
                    <SmileScoreSurvey 
                        userId={profile?.id || ""} 
                        userEmail={userEmail} 
                        isCapOneLinked={isCapOneLinked}
                        setCapOneMiles={setCapOneMiles}
                    />
                </div>

                <div className="space-y-8 mt-12">
                {/* ONLY SHOW IF CAMPUS IS SELECTED */}
                {campusAffiliation && (
                    <div className="app-surface p-6 rounded-3xl border border-[var(--border-soft)]">
                        <div className="flex justify-between items-start mb-6">
                            <div>
                                <h4 className="text-xl font-bold text-[var(--foreground)] flex items-center gap-2">
                                    CanvasIQ Integration
                                </h4>
                                <p className="text-sm text-[var(--foreground-muted)] mt-1">Live assignment sync & Aura mood forecasting.</p>
                            </div>
                            <button 
                                onClick={isCanvasLinked ? handleCanvasDisconnect : handleCanvasConnect} 
                                disabled={!isCanvasLinked && canvasSyncStatus !== "Connect LMS"}
                                className={`px-6 py-2.5 rounded-2xl font-semibold text-sm transition-colors ${
                                    isCanvasLinked 
                                        ? "bg-red-500/10 text-red-500 border border-red-500/20 hover:bg-red-500/20" 
                                        : canvasSyncStatus !== "Connect LMS" 
                                            ? "bg-[var(--background)] text-[var(--muted-text)] cursor-not-allowed"
                                            : "bg-teal-600 text-white hover:bg-teal-500"
                                }`}
                            >
                                {isCanvasLinked ? "Unsync Canvas" : canvasSyncStatus}
                            </button>
                        </div>

                            {/* EXPANDED VIEW ONCE SYNCED */}
                            {isCanvasLinked && (
                                <div className="mt-4 pt-4 border-t border-[var(--border-soft)] animate-in fade-in slide-in-from-top-4 duration-500">
                                    
                                    {/* Slider (Demo text removed to look professional) */}
                                    <div className="mb-4 bg-[var(--background)] p-4 rounded-2xl border border-[var(--border-soft)]">
                                        <p className="text-xs font-medium text-[var(--muted-text)] mb-3 uppercase tracking-wider">Aura Sync: Adjust Mood</p>
                                        <input 
                                            type="range" min="1" max="100" 
                                            value={demoMoodScore} 
                                            onChange={(e) => setDemoMoodScore(Number(e.target.value))} 
                                            className="w-full h-2 bg-[var(--surface-1)] rounded-lg appearance-none cursor-pointer accent-teal-500" 
                                        />
                                        <div className="flex justify-between text-[10px] mt-2 font-medium uppercase tracking-wide">
                                            <span className="text-red-400">Burnout</span>
                                            <span className="text-teal-500 text-sm">Score: {demoMoodScore}</span>
                                            <span className="text-green-400">Peak Flow</span>
                                        </div>
                                    </div>

                                    {/* AI Feedback Box */}
                                    <div className={`p-4 rounded-2xl mb-6 text-sm font-medium leading-relaxed border shadow-inner transition-all duration-500 ${
                                        demoMoodScore >= 75 ? 'bg-teal-500/10 border-teal-500/30 text-teal-100' :
                                        demoMoodScore >= 40 ? 'bg-indigo-500/10 border-indigo-500/30 text-indigo-100' :
                                        'bg-red-500/10 border-red-500/30 text-red-100'
                                    }`}>
                                        {getAIFeedback(demoMoodScore)}
                                    </div>

                                    <div className="space-y-3">
                                        <h5 className="text-xs font-medium uppercase text-[var(--muted-text)] tracking-wider pl-1">Live Feed: Next 72 Hours</h5>
                                        <div className="grid gap-3">
                                            {assignments.map((task) => (
                                                <div key={task.id} className="flex justify-between items-center bg-[var(--background)] p-4 rounded-2xl border border-[var(--border-soft)] hover:border-teal-500/30 transition-all hover:translate-x-1">
                                                    <div>
                                                        <p className="text-[var(--foreground)] font-bold text-sm">{task.title}</p>
                                                        <p className="text-xs font-medium text-[var(--foreground-muted)]">{task.course} • {task.due}</p>
                                                    </div>
                                                    <span className={`px-3 py-1 rounded-full text-[10px] font-medium uppercase tracking-wider border ${
                                                        task.stress === 'High' ? 'bg-red-500/10 text-red-400 border-red-500/20' :
                                                        task.stress === 'Medium' ? 'bg-orange-500/10 text-orange-400 border-orange-500/20' :
                                                        'bg-green-500/10 text-green-400 border-green-500/20'
                                                    }`}>
                                                        {task.stress}
                                                    </span>
                                                </div>
                                            ))}
                                        </div>
                                    </div>

                                </div>
                            )}
                        </div>
                    )}
                    <div className="app-surface p-6 rounded-3xl border border-[var(--border-soft)] flex justify-between items-center">
                        <div>
                            <h4 className="text-lg font-semibold text-[var(--foreground)]">Aura Atlas Pro</h4>
                            <p className="text-sm text-[var(--muted-text)] mt-1">$5.49/mo for advanced mood forecasting.</p>
                        </div>
                        <button
                            onClick={() => setShowCheckout(true)}
                            disabled={isPremium}
                            className={`px-6 py-2.5 rounded-2xl font-semibold text-sm transition-colors ${
                                isPremium
                                    ? "bg-teal-500/10 text-teal-500 border border-teal-500/20 cursor-default"
                                    : "bg-teal-600 text-white hover:bg-teal-500"
                            }`}
                        >
                            {isPremium ? "Active" : "Upgrade"}
                        </button>
                    </div>
                </div>

                <CollegePicker
                    currentCollege={college}
                    currentCity={profile?.city ?? null}
                    currentMajor={profile?.major ?? null}
                    currentGrade={profile?.grade ?? null}
                    onSave={handleCollegeSave}
                />

                <CampusDashboard
                    college={college}
                    campusInsights={campusInsights}
                    journalEntries={journalEntries}
                    loading={isCampusLoading}
                />

                <div className="mt-12 app-surface p-8 rounded-3xl border border-[var(--border-soft)]">
                    <div className="flex justify-between items-start mb-6">
                        <div>
                            <h3 className="text-2xl font-bold text-[var(--foreground)]">Meet Your Campus</h3>
                            <p className="text-sm text-[var(--foreground-muted)]">Connect with real classmates at your school.</p>
                        </div>
                    </div>

                    {campusPeers.length === 0 ? (
                        <div className="py-12 text-center bg-[var(--background)] rounded-3xl border-2 border-dashed border-[var(--border-soft)]">
                            <p className="text-[var(--foreground-muted)]">No peers found at your school yet. Invite some friends!</p>
                        </div>
                    ) : (
                        <div className="grid gap-4">
                            {campusPeers.map((peer) => (
                                <div key={peer.id} className="flex items-center justify-between p-4 rounded-3xl bg-[var(--background)] border border-[var(--border-soft)] hover:border-teal-500/40 transition-all group">
                                    <div className="flex items-center gap-4">
                                        <div className="h-12 w-12 rounded-2xl bg-[var(--surface-2)] flex items-center justify-center text-sm font-mono text-[var(--muted-text)] border border-[var(--border-soft)]">
                                            {peer.unique_code?.substring(0, 2)}
                                        </div>
                                        <div>
                                            <p className="text-[var(--foreground)] font-medium">Campus Peer <span className="text-[var(--muted-text)] font-mono text-xs ml-2">#{peer.unique_code}</span></p>
                                            <p className="text-xs text-[var(--muted-text)] mt-0.5">Classmate</p>
                                        </div>
                                    </div>

                                    <button
                                        type="button"
                                        onClick={() => handleAddCampusPeer(peer.unique_code ?? undefined)}
                                        aria-label={`Send friend request to ${peer.unique_code || "this classmate"}`}
                                        className="px-5 py-2 text-xs font-medium rounded-xl bg-teal-500/10 text-teal-500 hover:bg-teal-500/20 transition-colors"
                                    >
                                        Add Friend
                                    </button>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                <div className="mt-12 flex justify-center">
                    <button
                        onClick={handleLogout}
                        className="px-8 py-3 rounded-2xl bg-red-500/10 border border-red-500/20 text-red-400 font-medium hover:bg-red-500/20 transition-colors"
                    >
                        Log Out
                    </button>
                </div>
            </div>


            {showCheckout && (
                <StripeCheckout 
                    userId={profile?.id || ""} 
                    userEmail={userEmail} 
                    onClose={() => setShowCheckout(false)} 
                />
            )}

            {/* 💳 Capital One Simulated OAuth Modal */}
            {showCapOneModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm animate-in fade-in duration-200">
                    <div className="bg-white w-96 rounded-2xl overflow-hidden shadow-2xl">
                        
                        {/* Capital One Brand Header */}
                        <div className="bg-[#004879] p-6 text-center relative">
                            <button 
                                onClick={() => setShowCapOneModal(false)}
                                className="absolute top-4 right-4 text-white/70 hover:text-white"
                            >
                                ✕
                            </button>
                            <h2 className="text-3xl font-bold text-white tracking-tight mt-2">Capital One</h2>
                            <p className="text-blue-200 text-sm mt-1 font-medium">Secure Integration Gateway</p>
                        </div>

                        {/* Fake Login Form */}
                        <div className="p-7">
                            <p className="text-gray-600 text-xs text-center mb-5">
                                Sign in to link your account to Aura Atlas.
                            </p>
                            
                            <input 
                                type="text" 
                                placeholder="Username" 
                                className="w-full mb-4 p-3 border border-gray-300 rounded-xl bg-gray-50 text-black focus:outline-none focus:border-[#004879] focus:ring-1 focus:ring-[#004879]" 
                            />
                            <input 
                                type="password" 
                                placeholder="Password" 
                                className="w-full mb-6 p-3 border border-gray-300 rounded-xl bg-gray-50 text-black focus:outline-none focus:border-[#004879] focus:ring-1 focus:ring-[#004879]" 
                            />
                            
                            <button
                                onClick={() => {
                                    setIsAuthenticating(true);
                                    // Simulate network request for 1.5 seconds
                                    setTimeout(() => {
                                        // 1. Generate random miles between 450 and 2850
                                        const randomMiles = Math.floor(Math.random() * (2850 - 450 + 1)) + 450;
                                        
                                        // 2. Update the state and save it
                                        setCapOneMiles(randomMiles);
                                        localStorage.setItem('aura_capOneMiles', randomMiles.toString());
                                        
                                        // 3. Complete the login flow
                                        setIsCapOneLinked(true);
                                        setIsAuthenticating(false);
                                        setShowCapOneModal(false);
                                        toast.success(`Account linked! Found ${randomMiles.toLocaleString()} existing miles.`);
                                    }, 1500);
                                }}
                                disabled={isAuthenticating}
                                className="w-full bg-[#D22E1E] hover:bg-[#b02517] text-white font-bold py-3.5 rounded-xl transition-all flex justify-center items-center shadow-lg shadow-red-500/20 disabled:opacity-70"
                            >
                                {isAuthenticating ? (
                                    <span className="flex items-center gap-2">
                                        <svg className="animate-spin h-5 w-5 text-white" viewBox="0 0 24 24" fill="none">
                                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                        </svg>
                                        Authenticating...
                                    </span>
                                ) : (
                                    "Sign In"
                                )}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
