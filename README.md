# AuraAtlas

> *See how your campus feels right now — and get support before a bad week becomes a crisis.*

AuraAtlas is a real-time collective mental wellness platform built for college students. Mood check-ins from students across a campus aggregate into a living 3D emotional skyline — stress towers rise, calm zones glow — giving everyone a shared view of the emotional pulse of their community.

---

## What Makes It Different

Most mental health apps are individual. AuraAtlas is collective. When hundreds of students check in anonymously, patterns emerge: exam stress clustering near the library, calm zones in the park, anxiety spikes on Sunday nights. That shared awareness — "you're not alone in this" — is the core of the product.

**The 3D Emotional Skyline** is the centerpiece: mood data rendered as Mapbox fill-extrusion columns over real city geography. Stressed areas produce tall red towers. Calm zones produce short blue pillars. Dense clusters stack taller. It looks like a city breathing.

---

## Core Features

### Map & Visualization
- **3D Stress Skyline** — Mood check-ins aggregated into a spatial grid; each cell becomes a vertical column. Height = stress weight × report density. Color interpolates blue → green → yellow → orange → red.
- **Snap Map Heatmap** — Ground-level glow beneath the skyline. Cool blues for calm zones, warm reds for stressed zones.
- **Campus Layer** — Registered colleges appear as labeled zones on the map with their own emotion aggregation.
- **Emotion Weather Overlay** — Sentiment mapped to animated weather icons (storm clouds = anxiety, sunshine = calm).
- **11 Supported Cities** — NYC, LA, Chicago, Houston, Phoenix, Philadelphia, San Antonio, San Diego, Dallas, Jacksonville, Charlottesville.
- **City Navigation** — Arrow controls + keyboard navigation to fly between cities at 60° pitch.

### Check-Ins & Community
- **Daily Mood Check-In** — Select mood (Happy, Calm, Neutral, Sad, Overwhelmed, Stressed) with optional anonymous message. Updates the live map.
- **Hug Reactions** — Community support signals on anonymous check-ins.
- **Campus Detection** — Automatically detects if you're on a registered campus and tags your check-in.
- **70+ Colleges** — Pre-loaded with geofence detection and emotion dashboards per institution.

### AI Therapist
- **GPT-4o Powered** — Empathetic, reflective conversational support with a warm, somatic tone.
- **Voice Journal** — Record audio; Whisper transcribes it; AI analyzes and scores sentiment.
- **Crisis Detection** — Automatically flags concerning language and surfaces 988 hotline + campus support resources.
- **Rate Limited** — 10 requests/60 seconds per IP to prevent abuse.

### Personal Journal & Analytics
- **Mood Journal** — Rich entries with mood wheel, intensity slider, freeform text, image upload, and location tagging.
- **Smile Score** — Personal well-being metric (0–100) derived from check-in history.
- **Streak Tracking** — Consecutive days logged.
- **Report Dashboard** — Historical mood graphs, emoji distribution, time-of-day filters.

### Social
- **Friend System** — Friend requests via unique codes, pending/accepted/rejected states.
- **Leaderboard** — Mood improvement streaks, entry counts, wellness rankings.
- **In-App Chat** — Direct messaging within the friends tab.

### Campus Intelligence
- **Campus Emotion Dashboard** — Emotion distribution charts, trend data (daily/weekly/monthly), participant count, heatmap points, overall vibe score.
- **Privacy Redaction** — Aggregated data is hidden if fewer than 5 participants to prevent re-identification.

### Other
- **AR Mode** — Point your camera to see emotion overlays on physical spaces.
- **Stripe Payments** — Monthly subscription integration.
- **Email Notifications** — Resend + React Email templates.
- **Safe Spaces Finder** — Tag locations as calm, quiet, good-for-studying, or stressful.

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | Next.js 16 (App Router, TypeScript) |
| Styling | Tailwind CSS v4 |
| Map | Mapbox GL JS 3 — 3D terrain, fill-extrusion, heatmap layers |
| 3D | Three.js, @react-three/fiber, @react-three/drei |
| Animation | Framer Motion |
| Charts | Recharts |
| Database | Supabase (PostgreSQL + RLS + Storage) |
| Auth | Supabase Auth (email/password) |
| AI | OpenAI GPT-4o (therapist, analysis), Whisper (transcription), Google Gemini |
| Payments | Stripe |
| Email | Resend + React Email |
| Geospatial | @turf/circle, leaflet.heat |
| Validation | Zod |
| Video | Remotion |

---

## How the Skyline Works

Raw check-in points are aggregated into a grid (`lib/gridAggregator.ts`). Each grid cell becomes a small GeoJSON polygon with:

- **Height** = `f(average stress weight, report density)` — more reports and higher stress = taller column
- **Color** = interpolated from `#3b82f6` (calm) through green, yellow, orange to `#ef4444` (overwhelmed)

Mood weights: `Happy(0.1)` → `Calm(0.2)` → `Neutral(0.4)` → `Stressed(0.7)` → `Sad(0.85)` → `Overwhelmed(1.0)`

This solves the Mapbox limitation where `fill-extrusion` requires polygon geometry (raw points are silently ignored).

---

## Getting Started

```bash
npm install
npm run dev
```

Create `.env.local`:

```env
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
NEXT_PUBLIC_MAPBOX_TOKEN=pk.your_token_here
OPENAI_API_KEY=sk-your_openai_key
```

Optional (for full feature set):
```env
GOOGLE_GENERATIVE_AI_API_KEY=your_gemini_key
STRIPE_SECRET_KEY=sk_your_stripe_key
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_your_stripe_key
RESEND_API_KEY=re_your_resend_key
```

Open [http://localhost:3000](http://localhost:3000).

---

## Project Structure

```
app/
  api/                      # ~30 serverless API routes
    therapist/              # AI therapist chat + voice journal
    checkins/               # Anonymous mood check-in CRUD
    campus/                 # Campus emotion aggregation
    journal/                # Mood journal entries
    friends/                # Friend request management
    stripe/                 # Payment webhooks
  page.tsx                  # Main dashboard (3D map)
  journal/                  # Mood journaling interface
  ai-therapist/             # AI therapist chat page
  friends/                  # Social / friend management
  profile/                  # User profile
  report/                   # Analytics & insights
  ar/                       # Augmented reality mode

components/                 # 60+ React components
  Map3DView.tsx             # Mapbox 3D skyline + heatmap
  TherapistChat.tsx         # AI therapist conversation UI
  DailyCheckInModal.tsx     # Daily mood check-in prompt
  CampusLayer.tsx           # College emotion visualization
  ThermalMoodMatrix.tsx     # Heatmap radar for emotion zones
  VoiceRecorder.tsx         # Audio recording for voice journals
  EmotionWeatherOverlay.tsx # Weather-based mood animation

lib/
  gridAggregator.ts         # Aggregates points into polygon grid
  cityMask.ts               # Inverted polygon mask per city
  sentimentEngine.ts        # Mood → weather state mapping
  collegeList.ts            # 70+ colleges with geofence metadata
  store.ts                  # In-memory seed data (demo)
  types.ts                  # Core TypeScript interfaces
  rate-limit.ts             # IP-based rate limiting

hooks/
  useDailyCheckIn.ts        # Check-in state + localStorage
  useMoodEntry.ts           # Journal CRUD via Supabase
  useUserLocation.ts        # Geolocation tracking
```

---

## Security

- Rate limiting on all public endpoints (IP + user-based, 10 req/60s)
- Zod schema validation on all inputs (type checks, length limits, strict shape)
- Supabase Row Level Security on all tables
- No API keys exposed to client — all sensitive calls server-side
- Crisis detection with automatic 988 + campus resource surfacing
- OWASP top-10 informed input handling

---

## Mental Health Resources

If you or someone you know is struggling:

- **988 Suicide & Crisis Lifeline** — call or text 988
- **Crisis Text Line** — text HOME to 741741
- **NAMI Helpline** — 1-800-950-6264

---

## License

MIT
