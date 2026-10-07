import { Routes, Route, Navigate, useLocation } from "react-router-dom";
import LandingPage from "../pages/LandingPage";
import JobDetails from "../pages/JobDetails";
import NotFound from "../pages/NotFound";
import AdminLayout from "../admin/AdminLayout";
import AdminAddJob from "../pages/AdminAddJob";
import AdminJobs from "../pages/AdminJobs";
import AdminAffiliates from "../pages/AdminAffiliates";
import AdminDashboard from "../admin/AdminDashboard";

// Old links like /job.html?id=... still work
const LegacyJobRedirect = () => {
    const { search } = useLocation();
    return <Navigate to={`/job${search}`} replace />;
};

const AppRouter = () => {
    return (
        <Routes>
            <Route path="/" element={<LandingPage />} />
            <Route path="/job" element={<JobDetails />} />
            <Route path="/job.html" element={<LegacyJobRedirect />} />

            {/* Admin: AdminLayout handles sign-in, then shows the page below it */}
            <Route path="/admin" element={<AdminLayout />}>
                <Route index element={<AdminDashboard />} />
                <Route element={<Navigate to="add" replace />} />
                <Route path="add" element={<AdminAddJob />} />
                <Route path="edit/:id" element={<AdminAddJob />} />
                <Route path="jobs" element={<AdminJobs />} />
                <Route path="affiliates" element={<AdminAffiliates />} />
            </Route>

            <Route path="*" element={<NotFound />} />
        </Routes>
    );
};

export default AppRouter;