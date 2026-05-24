import { useState, useEffect, useMemo } from 'react';
import './styles/themes.css';
import './styles/globals.css';
import './styles/animations.css';
import './styles/chatbot.css';
import './styles/components.css';
import './styles/aurora.css';
import './styles/motion.css';

import ParticleBackground from './shared/ParticleBackground';
import GeometricGridBackground from './shared/GeometricGridBackground';
import ScrollProgress from './shared/ScrollProgress';
import Navbar from './shared/Navbar';
import HeroSection from './pages/home/HeroSection';
import ActivitiesSection from './pages/activities/ActivitiesSection';
import EventsSection from './pages/events/EventsSection';
import AboutSection from './pages/about/AboutSection';
import TeamSection from './pages/team/TeamSection';
import Footer from './shared/Footer';
import ActivityDetailPage from './pages/activities/ActivityDetailPage';
import EventDetailPage from './pages/events/EventDetailPage';
import CinematicOpening from './shared/CinematicOpening';
import Chatbot from './shared/Chatbot';
import DashboardPage from './pages/dashboard/DashboardPage';
import GamificationDashboard from './components/gamification/GamificationDashboard';

import {
  AmbientOrbs, SectionDivider,
  useNsReveal, useHeroParallax,
  useNavScrollTint, useGlobalMouseParallax, useMagneticCards,
} from './shared/MotionLayer';
// Admin has moved to the standalone dashboard (admin-dashboard/)
// The standalone admin app runs separately (dev: http://localhost:5174)

import ActivitiesPage from './pages/activities/ActivitiesPage';
import EventsPage from './pages/events/EventsPage';
import AboutPage from './pages/about/AboutPage';
import TeamPage from './pages/team/TeamPage';
import ContactPage from './pages/contact/ContactPage';
import RecruitmentPage from './pages/recruitment/RecruitmentPage';
import MembershipPage from './pages/membership/MembershipPage';

import { activityPages } from './data/activities/index';
import { events as fallbackEvents } from './data/eventsData';
import Cursor from './components/Cursor';
import Wipe from './components/Wipe';
import PageIn from './components/PageIn';

import { useInteractionEffects } from './hooks/useInteractionEffects';
import { useBackToTop, useActiveTabObserver } from './hooks/useScrollLogic';
import { useThemeManagement, useDynamicEvents } from './hooks/useDataHooks';
import { useAppNavigation } from './hooks/useAppNavigation';
import { useAppActions } from './hooks/useAppActions';

import { NAV_HEIGHTS, SCROLL_TIMEOUT } from './data/config';

const NAV_TABS = ['Home', 'Activities', 'Events', 'About', 'Team', 'Contact', 'Dashboard', 'Gamification'];

export default function App() {
  const [cinDone, setCinDone] = useState(false);
  const [activeTab, setActiveTab] = useState('Home');
  const [page, setPage] = useState(null);
  const [mobile, setMobile] = useState(window.innerWidth <= 768);

  const { theme, toggleTheme } = useThemeManagement();
  const eventsData = useDynamicEvents(fallbackEvents);
  const { wipeOn, wipePh, handleTabChange, performTransition } = useAppNavigation(setPage, setActiveTab, mobile);
  const actions = useAppActions(performTransition, setPage, setActiveTab, mobile);

  useEffect(() => {
    const handleResize = () => setMobile(window.innerWidth <= 768);
    window.addEventListener('resize', handleResize, { passive: true });
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useInteractionEffects(cinDone, page);
  useBackToTop();
  useActiveTabObserver(page, mobile, NAV_TABS, NAV_HEIGHTS, setActiveTab);

  useNsReveal([cinDone, page]);
  useHeroParallax();
  useNavScrollTint();
  useGlobalMouseParallax();
  useMagneticCards();

  const navHeight = mobile ? NAV_HEIGHTS.MOBILE : NAV_HEIGHTS.DESKTOP;
  const currentActivity = page?.activityKey ? activityPages[page.activityKey] : null;

  return (
    <>
      <Chatbot />
      {!cinDone && <CinematicOpening theme={theme} onDone={() => setCinDone(true)} />}

      {cinDone && (
        <>
          <ScrollProgress />
          <Cursor />
          <Wipe on={wipeOn} ph={wipePh} />
          <AmbientOrbs theme={theme} />
          <GeometricGridBackground theme={theme} />
          <ParticleBackground theme={theme} />
          <Navbar activeTab={activeTab} onTabChange={handleTabChange} onToggleTheme={toggleTheme} theme={theme} />
        </>
      )}

      <main className="app-main" style={{ paddingTop: navHeight }}>
        <>
          {page?.type === 'section' && (
            <SectionContent page={page} eventsData={eventsData} actions={actions} />
          )}

<<<<<<< HEAD
      {cinDone && <AmbientOrbs theme={theme}/>}
      {cinDone && <GeometricGridBackground theme={theme} />}
      {cinDone && <ParticleBackground theme={theme}/>}
      {cinDone && <Navbar activeTab={activeTab} onTabChange={onTab} onToggleTheme={toggleTheme} theme={theme} onApply={openApply} onJoin={openJoin}/>}

      <main style={{paddingTop:nh, position:'relative', zIndex:1}}>
        {/* If page is null, show home sections. Otherwise show the specific page. */}
        {page ? (
           <PageIn k={page.type + (page.section || page.activityKey)}>
             {page.section === 'Activities' && <ActivitiesPage onNavigate={onNavigate} onBack={onBackHome}/>}
             {page.section === 'Events' && <EventsPage onBack={onBackHome} onEventClick={onKSSClick} events={eventsData}/>}
             {page.section === 'About' && <AboutPage onBack={onBackHome}/>}
             {page.section === 'Team' && <TeamPage onBack={onBackHome} onApply={openApply}/>}
             {page.section === 'Contact' && <ContactPage onBack={onBackHome}/>}
             {page.type === 'activity' && cur && <ActivityDetailPage activity={cur} onBack={onBackMain} onSelectEvent={onEvent}/>}
             {page.type === 'apply' && <RecruitmentPage onBack={onBackHome}/>}
             {page.type === 'join' && <MembershipPage onBack={onBackHome}/>}
            {page.type === 'admin' && (
              <div style={{ maxWidth: 760, margin: '6vh auto', padding: '2rem', textAlign: 'center', borderRadius: 12, background: 'var(--card)', boxShadow: 'var(--shadow-card)' }}>
                <button onClick={onBackHome} className="btn-back">← Back</button>
                <h2 style={{ marginTop: 12 }}>Admin Panel moved</h2>
                <p style={{ opacity: 0.8 }}>The admin interface now lives in the standalone NexaSphere Control Center. Run it locally from <code>admin-dashboard/</code> or open the deployed admin URL below.</p>
                <div style={{ marginTop: 18 }}>
                  <a href={import.meta.env.DEV ? 'http://localhost:5174' : 'https://admin.nexasphere-glbajaj.vercel.app'} target="_blank" rel="noreferrer" className="btn btn-primary">Open NexaSphere Control Center</a>
                </div>
              </div>
            )}
             {page.type === 'event' && page.event && <EventDetailPage event={page.event} onBack={page.activityKey ? onBackAct : onBackMain}/>}
             {/* 404 fallback for unknown page types */}
             {page.type && !['section','activity','event','apply','join'].includes(page.type) && <NotFoundPage onGoHome={onBackHome}/>}
           </PageIn>
        ) : (
          cinDone && (
            <PageIn k="main">
              <HeroSection onTabChange={onTab} onApply={openApply} onJoin={openJoin} theme={theme}/>
              <SectionDivider/>
              <ActivitiesSection onNavigate={onNavigate}/>
              <SectionDivider/>
              <EventsSection onEventClick={onKSSClick} events={eventsData}/>
              <SectionDivider/>
              <AboutSection/>
              <SectionDivider/>
              <TeamSection onApply={openApply}/>
              <Footer onAdmin={() => nav(() => setPage({ type: 'admin' }))} />
=======
          {page?.type === 'activity' && currentActivity && (
            <PageIn k={`a-${page.activityKey}`}>
              <ActivityDetailPage
                activity={currentActivity}
                onBack={() => performTransition(() => setPage({ type: 'section', section: 'Activities' }))}
                onSelectEvent={actions.onEvent}
              />
>>>>>>> upstream/main
            </PageIn>
          )}

          {page?.type === 'event' && page.event && currentActivity && (
            <PageIn k={`e-${page.event?.id}`}>
              <EventContent page={page} currentActivity={currentActivity} onBack={actions.onBackActivity} />
            </PageIn>
          )}

          {page?.type === 'apply' && (
            <PageIn k="pg-apply">
              <RecruitmentPage onBack={actions.onBackHome} />
            </PageIn>
          )}

          {page?.type === 'join' && (
            <PageIn k="pg-join">
              <MembershipPage onBack={actions.onBackHome} />
            </PageIn>
          )}

          {page?.type === 'gamification' && (
            <PageIn k="pg-gamification">
              <GamificationDashboard />
            </PageIn>
          )}

          {!page && cinDone && (
            <PageIn k="main">
              <MainContent actions={actions} theme={theme} handleTabChange={handleTabChange} eventsData={eventsData} />
            </PageIn>
          )}
        </>
      </main>

      {cinDone && <button id="back-to-top" aria-label="Back to top">▲</button>}
    </>
  );
}

function SectionContent({ page, eventsData, actions }) {
  switch (page.section) {
    case 'Activities':
      return <PageIn k="pg-activities"><ActivitiesPage onNavigate={actions.onNavigate} onBack={actions.onBackHome} /></PageIn>;
    case 'Events':
      return <PageIn k="pg-events"><EventsPage onBack={actions.onBackHome} onEventClick={actions.onKSSClick} events={eventsData} /></PageIn>;
    case 'About':
      return <PageIn k="pg-about"><AboutPage onBack={actions.onBackHome} /></PageIn>;
    case 'Team':
      return <PageIn k="pg-team"><TeamPage onBack={actions.onBackHome} onApply={actions.openApply} /></PageIn>;
    case 'Contact':
      return <PageIn k="pg-contact"><ContactPage onBack={actions.onBackHome} /></PageIn>;
    case 'Dashboard':
      return <PageIn k="pg-dashboard"><DashboardPage onBack={actions.onBackHome} /></PageIn>;
    default:
      return null;
  }
}

function EventContent({ page, currentActivity, onBack }) {
  const displayEvent = useMemo(() => {
    const isKssEvent = page.event.id === 1 || page.event.id === 'kss-153' || String(page.event.shortName || '').toLowerCase().includes('kss');
    if (page.activityKey === 'Insight Session' && isKssEvent) {
      return currentActivity.conductedEvents?.find(e => e.id === 'kss-153') || page.event;
    }
    return page.event;
  }, [page.event, page.activityKey, currentActivity.conductedEvents]);

  return (
    <EventDetailPage
      event={displayEvent}
      activityColor={currentActivity.color}
      activityIcon={currentActivity.icon}
      onBack={onBack}
    />
  );
}

function MainContent({ actions, theme, handleTabChange, eventsData }) {
  return (
    <>
      <HeroSection onTabChange={handleTabChange} onApply={actions.openApply} onJoin={actions.openJoin} theme={theme} />
      <SectionDivider />
      <ActivitiesSection onNavigate={actions.onNavigate} />
      <SectionDivider />
      <EventsSection onEventClick={actions.onKSSClick} events={eventsData} />
      <SectionDivider />
      <AboutSection />
      <SectionDivider />
      <TeamSection onApply={actions.openApply} />
      <Footer />
    </>
  );
}