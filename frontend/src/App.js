import { Route, BrowserRouter as Router, Routes } from 'react-router-dom';
import AddItem from './components/user/AddItem';
import AdminDasherList from './components/admin/AdminDasherList';
import AdminIncomingOrder from './components/admin/AdminIncomingOrder';
import AdminOrderHistory from './components/admin/AdminOrderHistory';
import AdminRoute from './components/admin/AdminRoute';
import Checkout from './components/user/Checkout';
import DasherApplication from './components/dasher/DasherApplication';
import ForgotPassword from './components/user/ForgotPassword';
import Home from './components/user/Home';
import LandingPage from './components/LandingPage';
import LoginSignUp from './components/LoginSignUp';
import Order from './components/user/Order';
import PrivateRoute from './components/PrivateRoute';
import PublicRoute from './components/PublicRoute';
import ResetPassword from './components/user/ResetPassword';
import Shop from './components/shop/Shop';
import ShopApplication from './components/shop/ShopApplication';
import ShopManage from './components/shop/ShopManage';
import ShopReviews from './components/shop/ShopReviews';
import ShopRoute from './components/shop/ShopRoute';
import UpdateItem from './components/user/UpdateItem';
import UserProfile from './components/user/UserProfile';
import { AuthProvider } from './utils/AuthContext';
// import UpdateShop from './components/UpdateShop';
import { Toaster } from 'sonner';
import AdminAnalytics from './components/admin/AdminAnalytics';
import AdminCashoutList from './components/admin/AdminCashoutList';
import AdminReimburseList from './components/admin/AdminReimburseList';
import AdminShopList from './components/admin/AdminShopList';
import DasherCashout from './components/dasher/DasherCashout';
import DasherHome from './components/dasher/DasherHome';
import DasherIncomingOrder from './components/dasher/DasherIncomingOrder';
import DasherReimburse from './components/dasher/DasherReimburse';
import DasherRoute from './components/dasher/DasherRoute';
import DasherTopup from './components/dasher/DasherTopup';
import DasherUpdate from './components/dasher/DasherUpdate';
import MainLayout from './components/Layouts/MainLayout';
import ShopIncomingOrder from './components/shop/ShopIncomingOrder';
import ShopUpdate from './components/shop/ShopUpdate';
import VerificationFailed from './components/VerificationFailed';
import VerificationSuccess from './components/VerificationSuccess';
import { OrderProvider } from './context/OrderContext';

import 'react-confirm-alert/src/react-confirm-alert.css';
import ProfileRoute from './components/ProfileRoute';
import AdminUsers from './components/admin/AdminUsers';

function App() {
  return (
      <Router>
        <AuthProvider>
          <OrderProvider>
            <Routes>
              <Route element={<MainLayout/>}>
                {/*public*/}
                <Route path="/forgot-password" element={<PublicRoute Component={ForgotPassword} />} />
                <Route path="/reset-password/" element={<PublicRoute Component={ResetPassword} />} />
                <Route path="/login" element={<PublicRoute Component={LoginSignUp} />} />
                <Route path="/signup" element={<PublicRoute Component={LoginSignUp} />} />
                <Route path="/" element={<PublicRoute Component={LandingPage} />} />
                <Route path="/profile" element={<ProfileRoute Component={UserProfile} />} />
                <Route path="/home" element={<PrivateRoute Component={Home}/>} />
                <Route path="/orders" element={<PrivateRoute Component={Order} />} />

                <Route path="/verification-success" element={<VerificationSuccess />} />
                <Route path="/verification-failed" element={<VerificationFailed />} />

                {/*admin*/}
                <Route path="/admin-analytics" element={<AdminRoute Component={AdminAnalytics} />} />
                <Route path="/admin-dashers" element={<AdminRoute Component={AdminDasherList} />} />
                <Route path="/admin-incoming-order" element={<AdminRoute Component={AdminIncomingOrder} />} />
                <Route path="/admin-order-history" element={<AdminRoute Component={AdminOrderHistory} />} />
                <Route path="/admin-shops" element={<AdminShopList />} />
                <Route path="/admin-users" element={<AdminUsers />} />
                <Route path="/admin-cashouts" element={<AdminRoute Component={AdminCashoutList} />} />
                <Route path="/admin-reimburse" element={<AdminRoute Component={AdminReimburseList} />} />

                {/*dasher*/}
                <Route path="/dasher-application" element={<PrivateRoute Component={DasherApplication} />} />
                <Route path="/dasher-orders" element={<DasherRoute Component={DasherHome} />} />
                <Route path="/dasher-incoming-order" element={<DasherRoute Component={DasherIncomingOrder} />} />
                <Route path="/dasher-update" element={<DasherRoute Component={DasherUpdate}/>} />
                <Route path="/cashout" element={<DasherRoute Component={DasherCashout}/>} />
                <Route path="/dasher-reimburse" element={<DasherRoute Component={DasherReimburse}/>} />
                <Route path="/dasher-topup" element={<DasherRoute Component={DasherTopup}/>} />

                {/*shop*/}
                <Route path="/checkout/:uid/:shopId" element={<PrivateRoute Component={Checkout} />} />
                <Route path="/shop/:shopId" element={<PrivateRoute Component={Shop} />} />
                <Route path="/shop-application" element={<PrivateRoute Component={ShopApplication} />} />
                <Route path="/shop-add-item" element={<ShopRoute Component={AddItem} />} />
                <Route path="/shop-update" element={<ShopRoute Component={ShopUpdate} />} />
                <Route path="/edit-item/:itemId" element={<ShopRoute Component={UpdateItem} />} />
                <Route path="/shop-dashboard" element={<ShopRoute Component={ShopIncomingOrder} />} />
                <Route path="/shop-manage-item" element={<ShopRoute Component={ShopManage} />} />
                <Route path="/shop-reviews" element={<ShopRoute Component={ShopReviews} />} />
              </Route>
            </Routes>
            <Toaster expand={true} richColors/>
          </OrderProvider>
        </AuthProvider>
      </Router>
    
  );
}

export default App;
