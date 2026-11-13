import { lazy, Suspense } from 'react';
import { createBrowserRouter, RouterProvider, Outlet, ScrollRestoration } from 'react-router-dom';
import { Toaster } from 'sonner';
import { ErrorBoundary, OfflineBanner, CelebrationLayer } from '@/components/feedback/Feedback';
import { StudentLayout, FocusLayout } from '@/components/layout/StudentLayout';
import { RequireAuth, RequireOnboarded, RequireNotOnboarded, PublicOnly, RequireAdmin } from '@/routes/guards';
import { PageSkeleton } from '@/components/ui';
import { AuthBootstrap } from '@/features/auth/AuthBootstrap';

// Route-level code splitting keeps the first paint small (NFR-01)
const Landing = lazy(() => import('@/features/public/LandingPage'));
const Privacy = lazy(() => import('@/features/public/LegalPages').then((m) => ({ default: m.PrivacyPage })));
const Terms = lazy(() => import('@/features/public/LegalPages').then((m) => ({ default: m.TermsPage })));
const NotFound = lazy(() => import('@/features/public/NotFoundPage'));
const Login = lazy(() => import('@/features/auth/LoginPage'));
const Signup = lazy(() => import('@/features/auth/SignupPage'));
const Forgot = lazy(() => import('@/features/auth/ForgotPasswordPage'));
const Onboarding = lazy(() => import('@/features/onboarding/OnboardingPage'));
const Home = lazy(() => import('@/features/home/HomePage'));
const Learn = lazy(() => import('@/features/learn/LearnPage'));
const Chapter = lazy(() => import('@/features/learn/ChapterPage'));
const Topic = lazy(() => import('@/features/learn/TopicPage'));
const PracticeHub = lazy(() => import('@/features/practice/PracticeHubPage'));
const PracticeSession = lazy(() => import('@/features/practice/PracticeSessionPage'));
const Challenge = lazy(() => import('@/features/challenge/ChallengePage'));
const ChallengeResult = lazy(() => import('@/features/challenge/ChallengeResultPage'));
const Tests = lazy(() => import('@/features/tests/TestsPage'));
const TestDetail = lazy(() => import('@/features/tests/TestDetailPage'));
const TestPlayer = lazy(() => import('@/features/tests/TestPlayerPage'));
const TestResult = lazy(() => import('@/features/tests/TestResultPage'));
const Series = lazy(() => import('@/features/tests/SeriesPage'));
const Doubts = lazy(() => import('@/features/doubts/DoubtsPage'));
const DoubtSession = lazy(() => import('@/features/doubts/DoubtSessionPage'));
const Mistakes = lazy(() => import('@/features/mistakes/MistakesPage'));
const MistakeDetail = lazy(() => import('@/features/mistakes/MistakeDetailPage'));
const Progress = lazy(() => import('@/features/progress/ProgressPage'));
const Leaderboard = lazy(() => import('@/features/leaderboard/LeaderboardPage'));
const Rewards = lazy(() => import('@/features/rewards/RewardsPage'));
const Profile = lazy(() => import('@/features/profile/ProfilePage'));
const Settings = lazy(() => import('@/features/profile/SettingsPage'));
const ParentReport = lazy(() => import('@/features/profile/ParentReportPage'));

const ParentReportView = lazy(() => import('@/features/profile/ParentReportViewPage'));
const AdminLogin = lazy(() => import('@/features/admin/AdminLoginPage'));
const AdminLayout = lazy(() => import('@/features/admin/AdminLayout'));
const AdminDashboard = lazy(() => import('@/features/admin/DashboardPage'));
const AdminCurriculum = lazy(() => import('@/features/admin/CurriculumPage'));
const AdminMaterials = lazy(() => import('@/features/admin/MaterialsPage'));
const AdminQuestions = lazy(() => import('@/features/admin/QuestionsPage'));
const AdminQuestionEditor = lazy(() => import('@/features/admin/QuestionEditorPage'));
const AdminImport = lazy(() => import('@/features/admin/ImportPage'));
const AdminTests = lazy(() => import('@/features/admin/TestsAdminPage'));
const AdminKb = lazy(() => import('@/features/admin/KnowledgeBasePage'));
const AdminConfig = lazy(() => import('@/features/admin/ConfigPage'));
const AdminStudents = lazy(() => import('@/features/admin/StudentsPage'));
const AdminModeration = lazy(() => import('@/features/admin/ModerationPage'));
const AdminAudit = lazy(() => import('@/features/admin/AuditPage'));

function Root() {
  return (
    <ErrorBoundary>
      <OfflineBanner />
      <AuthBootstrap>
        <Suspense fallback={<div className="mx-auto max-w-5xl p-6"><PageSkeleton /></div>}>
          <Outlet />
        </Suspense>
      </AuthBootstrap>
      <CelebrationLayer />
      <Toaster position="top-center" richColors closeButton toastOptions={{ className: 'font-sans' }} />
      <ScrollRestoration />
    </ErrorBoundary>
  );
}

const router = createBrowserRouter([
  {
    element: <Root />,
    children: [
      { path: '/', element: <Landing /> },
      { path: '/privacy', element: <Privacy /> },
      { path: '/terms', element: <Terms /> },
      { path: '/parent-report/view', element: <ParentReportView /> },
      { path: '/parent-report', element: <ParentReportView /> },
      {
        element: <PublicOnly />,
        children: [
          { path: '/login', element: <Login /> },
          { path: '/signup', element: <Signup /> },
          { path: '/forgot-password', element: <Forgot /> },
        ],
      },
      {
        element: <RequireAuth />,
        children: [
          { element: <RequireNotOnboarded />, children: [{ path: '/onboarding', element: <Onboarding /> }] },
          {
            element: <RequireOnboarded />,
            children: [
              {
                element: <StudentLayout />,
                children: [
                  { path: '/home', element: <Home /> },
                  { path: '/learn', element: <Learn /> },
                  { path: '/learn/chapter/:chapterId', element: <Chapter /> },
                  { path: '/learn/topic/:topicId', element: <Topic /> },
                  { path: '/practice', element: <PracticeHub /> },
                  { path: '/practice/session/:setId', element: <PracticeSession /> },
                  { path: '/tests', element: <Tests /> },
                  { path: '/tests/series', element: <Tests /> },
                  { path: '/tests/series/:seriesId', element: <Series /> },
                  { path: '/tests/result/:attemptId', element: <TestResult /> },
                  { path: '/tests/:testId', element: <TestDetail /> },
                  { path: '/doubts', element: <Doubts /> },
                  { path: '/doubts/:doubtId', element: <DoubtSession /> },
                  { path: '/mistakes', element: <Mistakes /> },
                  { path: '/mistakes/:mistakeId', element: <MistakeDetail /> },
                  { path: '/progress', element: <Progress /> },
                  { path: '/leaderboard', element: <Leaderboard /> },
                  { path: '/rewards', element: <Rewards /> },
                  { path: '/profile', element: <Profile /> },
                  { path: '/settings', element: <Settings /> },
                  { path: '/settings/parent-report', element: <ParentReport /> },
                  { path: '/challenge/result', element: <ChallengeResult /> },
                ],
              },
              {
                element: <FocusLayout />,
                children: [
                  { path: '/challenge', element: <Challenge /> },
                  { path: '/tests/:testId/play', element: <TestPlayer /> },
                ],
              },
            ],
          },
        ],
      },
      { path: '/admin/login', element: <AdminLogin /> },
      {
        element: <RequireAdmin />,
        children: [
          {
            path: '/admin',
            element: <AdminLayout />,
            children: [
              { index: true, element: <AdminDashboard /> },
              { path: 'curriculum', element: <AdminCurriculum /> },
              { path: 'materials', element: <AdminMaterials /> },
              { path: 'questions', element: <AdminQuestions /> },
              { path: 'questions/new', element: <AdminQuestionEditor /> },
              { path: 'questions/import', element: <AdminImport /> },
              { path: 'questions/:questionId', element: <AdminQuestionEditor /> },
              { path: 'tests', element: <AdminTests /> },
              { path: 'knowledge-base', element: <AdminKb /> },
              { path: 'config', element: <AdminConfig /> },
              { path: 'students', element: <AdminStudents /> },
              { path: 'moderation', element: <AdminModeration /> },
              { path: 'audit', element: <AdminAudit /> },
            ],
          },
        ],
      },
      { path: '*', element: <NotFound /> },
    ],
  },
]);

export default function App() {
  return <RouterProvider router={router} />;
}
