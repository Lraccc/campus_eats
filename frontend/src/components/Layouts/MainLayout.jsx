import Navbar from "../Navbar/Navbar";
import { Outlet, useLocation } from "react-router-dom";

const MainLayout = () => {
  const location = useLocation();

  return (
    <div>
       {location.pathname !== '/verification-success' && location.pathname !== '/verification-failed' && <Navbar />}
      <main>
        <Outlet />
      </main>
    </div>
  );
};

export default MainLayout;
