import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { PlatformProvider, usePlatform } from "../providers/PlatformProvider";
import { AdminLayout } from "../layouts/AdminLayout";
import { AttendeeLayout } from "../layouts/AttendeeLayout";
import { PublicLayout } from "../layouts/PublicLayout";
import { HomePage } from "../../features/events/HomePage";
import { EventsPage } from "../../features/events/EventsPage";
import { EventDetailPage } from "../../features/events/EventDetailPage";
import { SpeakersPage } from "../../features/speakers/SpeakersPage";
import { PublicSchedulePage } from "../../features/schedule/PublicSchedulePage";
import { RegisterPage } from "../../features/registration/RegisterPage";
import { CheckoutPage } from "../../features/checkout/CheckoutPage";
import { PaymentPage } from "../../features/checkout/PaymentPage";
import { ReceiptPage } from "../../features/checkout/ReceiptPage";
import { CreateAccountPage, ForgotPasswordPage, LoginPage } from "../../features/auth/AuthPages";
import { AboutPage, HelpPage, PartnersPage } from "../../features/public/InfoPages";
import { AttendeeDashboardPage } from "../../features/attendees/AttendeeDashboardPage";
import { TicketPage } from "../../features/tickets/TicketPage";
import { AttendeeSchedulePage } from "../../features/schedule/AttendeeSchedulePage";
import { NetworkingPage } from "../../features/networking/NetworkingPage";
import { NotificationsPage } from "../../features/notifications/NotificationsPage";
import { CertificatesPage } from "../../features/certificates/CertificatesPage";
import { ProfilePage } from "../../features/attendees/ProfilePage";
import { AdminDashboardPage } from "../../features/admin/AdminDashboardPage";
import { AdminEventsPage } from "../../features/admin/AdminEventsPage";
import {
  AdminAttendeesPage,
  AdminCheckInPage,
  AdminCommsPage,
  AdminEventEditPage,
  AdminEventNewPage,
  AdminPaymentsPage,
  AdminPosterPage,
  AdminReportsPage,
  AdminSchedulePage,
  AdminSettingsPage,
  AdminSponsorsPage,
  AdminTicketsPage,
  AdminTimelinePage,
} from "../../features/admin/AdminOpsPages";

function RoleHome() {
  const { role } = usePlatform();
  if (role === "admin") return <Navigate to="/admin" replace />;
  if (role === "attendee") return <Navigate to="/app" replace />;
  return <HomePage />;
}

export function AppRouter() {
  return (
    <PlatformProvider>
      <BrowserRouter>
        <Routes>
          <Route element={<PublicLayout />}>
            <Route path="/" element={<RoleHome />} />
            <Route path="/events" element={<EventsPage />} />
            <Route path="/events/:eventId" element={<EventDetailPage />} />
            <Route path="/speakers" element={<SpeakersPage />} />
            <Route path="/schedule" element={<PublicSchedulePage />} />
            <Route path="/about" element={<AboutPage />} />
            <Route path="/partners" element={<PartnersPage />} />
            <Route path="/help" element={<HelpPage />} />
            <Route path="/login" element={<LoginPage />} />
            <Route path="/register" element={<CreateAccountPage />} />
            <Route path="/forgot-password" element={<ForgotPasswordPage />} />
            <Route path="/register/:eventId" element={<RegisterPage />} />
            <Route path="/checkout/:registrationId" element={<CheckoutPage />} />
            <Route path="/payment/:paymentId" element={<PaymentPage />} />
            <Route path="/receipt/:registrationId" element={<ReceiptPage />} />
          </Route>
          <Route path="/app" element={<AttendeeLayout />}>
            <Route index element={<AttendeeDashboardPage />} />
            <Route path="ticket" element={<TicketPage />} />
            <Route path="schedule" element={<AttendeeSchedulePage />} />
            <Route path="networking" element={<NetworkingPage />} />
            <Route path="notifications" element={<NotificationsPage />} />
            <Route path="certificates" element={<CertificatesPage />} />
            <Route path="profile" element={<ProfilePage />} />
          </Route>
          <Route path="/admin" element={<AdminLayout />}>
            <Route index element={<AdminDashboardPage />} />
            <Route path="events" element={<AdminEventsPage />} />
            <Route path="events/new" element={<AdminEventNewPage />} />
            <Route path="events/:eventId" element={<AdminEventEditPage />} />
            <Route path="tickets" element={<AdminTicketsPage />} />
            <Route path="attendees" element={<AdminAttendeesPage />} />
            <Route path="check-in" element={<AdminCheckInPage />} />
            <Route path="schedule" element={<AdminSchedulePage />} />
            <Route path="timeline" element={<AdminTimelinePage />} />
            <Route path="poster" element={<AdminPosterPage />} />
            <Route path="communications" element={<AdminCommsPage />} />
            <Route path="sponsors" element={<AdminSponsorsPage />} />
            <Route path="payments" element={<AdminPaymentsPage />} />
            <Route path="reports" element={<AdminReportsPage />} />
            <Route path="settings" element={<AdminSettingsPage />} />
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </PlatformProvider>
  );
}
