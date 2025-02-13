import { faPen } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../utils/AuthContext";
import axios from "../utils/axiosConfig";
import "./css/Shop.css";

const ShopManage = () => {
    const { currentUser } = useAuth();
    const navigate = useNavigate();
    const [shop, setShop] = useState(null);
    const [items, setItems] = useState([]);
    const [isLoading, setIsLoading] = useState(false);

    const fetchShop = async () => {
        try {
            const response = await axios.get(`/shops/${currentUser.id}`);
            if (response.status !== 200) {
                throw new Error('Failed to fetch shop');
            }
            setShop(response.data);
            console.log("shop BUANG KA!", response.data);
        } catch (error) {
            console.error('Error fetching shop:', error);
        }
    };

    const fetchShopItems = async () => {
        try {
            const response = await axios.get(`/items/${currentUser.id}/shop-items`);
            if (response.status !== 200) {
                throw new Error('Failed to fetch shop items');
            }
            setItems(response.data);
        } catch (error) {
            console.error('Error fetching shop items:', error);
        }
    };

   useEffect(() => {
    const fetchData = async () => {
        setIsLoading(true); // Set loading to true before fetching
        await Promise.all([fetchShop(), fetchShopItems()]);
        setIsLoading(false); // Set loading to false after all fetches are complete
    };

    fetchData();
}, []);

    if (!shop) {
        return <div>Loading...</div>;
    }

    const renderCategories = (categories) => {
        if (!Array.isArray(categories)) return null;
        return categories.map((category, index) => (
            <h4 key={index}>{category}</h4>
        ));
    };


    return (
        <>
            
            <div className="o-body">
                 {isLoading  || shop === null || items.length === 0 ? <div className="flex justify-center items-center h-[90vh] w-[170vh]">
                        <div
                            className="inline-block h-36 w-36 animate-spin rounded-full border-4 border-solid border-current border-r-transparent align-[-0.125em] motion-reduce:animate-[spin_1.5s_linear_infinite]"
                            role="status">
                            <span
                                className="!absolute !-m-px !h-px !w-px !overflow-hidden !whitespace-nowrap !border-0 !p-0 ![clip:rect(0,0,0,0)]"
                            >Loading...</span>
                        </div>
                    </div>: <div className="s-container">
                    <div className="s-title-container">
                        <div className="s-photo">
                            <img src={shop.imageUrl} alt="store" className="s-photo-image" />
                        </div>
                        <div className="s-title">
                            <h2>{shop.name}</h2>
                            <p>{shop.address}</p>
                            <div className="s-title-subtext">
                                <div className="s-shopcat"><h4>Category</h4></div>
                                <div className="s-category">
                                    {renderCategories(shop.categories)}
                                </div>
                                <p>Delivery Fee</p>
                                <h4>₱{shop.deliveryFee}</h4>
                            </div>
                        </div>
                        <div className="sm-plus-icon" onClick={() => navigate(`/shop-update`)}>
                            <FontAwesomeIcon icon={faPen} />
                        </div>
                    </div>
                    <div className="s-items-container">
                        <h2>Items</h2>
                        <div className="s-content">
                            {items.map(item => (
                                <div key={item.id} className="s-card">
                                    <div className="s-img">
                                        <img src={item.imageUrl || '/Assets/Panda.png'} className="s-image-cover" alt="item" />
                                    </div>
                                    <div className="s-text">
                                        <div className="s-subtext">
                                            <p className="s-h3">{item.name}</p>
                                            <p className="s-p">{item.description}</p>
                                        </div>
                                        <h3>₱{item.price.toFixed(2)}</h3>
                                        <div className="s-plus-icon" onClick={() => navigate(`/edit-item/${item.id}`)}>
                                            <FontAwesomeIcon icon={faPen} />
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>}
            </div>
        </>
    );
}

export default ShopManage;
