import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../utils/AuthContext";
import axios from "../../utils/axiosConfig";
import CategoriesModal from "./CategoriesModal";

import "../css/Home.css";

const Home = () => {
    const { currentUser } = useAuth();
    const navigate = useNavigate();
    const [shops, setShops] = useState([]);
    const [topShops, setTopShops] = useState([]);
    const [isLoading, setIsLoading] = useState(false);
    const [showCategoriesModal, setShowCategoriesModal] = useState(false);
    const [selectedCategories, setSelectedCategories] = useState([]);
    const [selectedShopName, setSelectedShopName] = useState('');

    useEffect(() => {
        // Try to get user from localStorage if not in context
        let user = currentUser;
        if (!user) {
            const stored = localStorage.getItem('currentUser');
            if (stored) {
                user = JSON.parse(stored);
            }
        }
        if (!user) {
            navigate('/login');
        } else {
            fetchShops();
            fetchTopShops();
        }
    }, [currentUser, navigate]);

    const fetchShops = async () => {
        setIsLoading(true);
        try {
            const response = await axios.get(`/shops/active`);
            const data = await response.data;
            const shopsWithRatings = await Promise.all(
                data.map(async (shop) => {
                    const ratingResponse = await axios.get(`/ratings/shop/${shop.id}`);
                    const ratings = await ratingResponse.data;
                    const averageRating = calculateAverageRating(ratings);
                    return { ...shop, averageRating };
                })
            );
            setShops(shopsWithRatings);
        } catch (error) {
            console.error('Error fetching shops:', error);
        }
        setIsLoading(false);
    };

    const fetchTopShops = async () => {
        try {
            const response = await axios.get('/shops/top-performing');
            const topShops = response.data;
            
            // Get ratings for each top shop
            const topShopsWithRatings = await Promise.all(
                topShops.map(async (shop) => {
                    const ratingResponse = await axios.get(`/ratings/shop/${shop.id}`);
                    const ratings = ratingResponse.data;
                    const averageRating = calculateAverageRating(ratings);
                    return { ...shop, averageRating };
                })
            );

            setTopShops(topShopsWithRatings);
        } catch (error) {
            console.error('Error fetching top shops:', error);
        }
    };

    const calculateAverageRating = (ratings) => {
        if (!ratings || ratings.length === 0) return "No Ratings";
        const total = ratings.reduce((sum, rating) => sum + rating.rate, 0);
        const average = total / ratings.length;
        return average.toFixed(1);
    };

    const renderRatingStars = (rating) => {
        if (rating === "No Ratings") return <span className="text-gray-500">No Ratings</span>;
        
        const fullStars = Math.floor(rating);
        const hasHalfStar = rating % 1 >= 0.5;
        const emptyStars = 5 - fullStars - (hasHalfStar ? 1 : 0);

        return (
            <div className="flex items-center">
                <div className="flex">
                    {[...Array(fullStars)].map((_, i) => (
                        <span key={`full-${i}`} className="text-yellow-400">★</span>
                    ))}
                    {hasHalfStar && <span className="text-yellow-400">★</span>}
                    {[...Array(emptyStars)].map((_, i) => (
                        <span key={`empty-${i}`} className="text-gray-300">★</span>
                    ))}
                </div>
                <span className="ml-1 text-sm text-gray-600">({rating})</span>
            </div>
        );
    };

    const getGreeting = () => {
        const hour = new Date().getHours();
        if (hour < 6) return "Good Midnight";
        if (hour < 12) return "Good Morning";
        if (hour < 18) return "Good Afternoon";
        return "Good Evening";
    };

    const handleCardClick = (shopId) => {
        navigate(`/shop/${shopId}`);
    };

    const handleShowAllCategories = (categories, shopName, event) => {
        event.stopPropagation(); // Prevent triggering the card click
        setSelectedCategories(categories);
        setSelectedShopName(shopName);
        setShowCategoriesModal(true);
    };

    const renderLimitedCategories = (categories, maxVisible = 2, shopName = '') => {
        if (!categories || categories.length === 0) return null;
        
        const visibleCategories = categories.slice(0, maxVisible);
        const remainingCount = categories.length - maxVisible;
        
        return (
            <>
                {visibleCategories.map((category, idx) => (
                    <p className="h-p" key={idx}>{category}</p>
                ))}
                {remainingCount > 0 && (
                    <p 
                        className="h-p h-p-clickable" 
                        key="remaining"
                        onClick={(e) => handleShowAllCategories(categories, shopName, e)}
                        title={`Click to see all ${categories.length} categories`}
                    >
                        +{remainingCount}
                    </p>
                )}
            </>
        );
    };

    return (
        <div className="h-body">
            <div className="h-title">
                <h2 className="font-semibold" style={{ fontSize: '24px' }}>
                    {getGreeting()}, {currentUser?.username}!
                </h2>
                <p>Start Simplifying Your Campus Cravings!</p>
            </div>

            {/* Most Purchase Shop Section */}
            <div>
                <h3 className="text-xl font-semibold mb-4">Most Purchase Shop</h3>
                <div className="h-content">
                    {topShops.map((shop, index) => (
                        <div key={index} className="h-card" onClick={() => handleCardClick(shop.id)}>
                            <div className="h-img">
                                <img src={shop.imageUrl} className="h-image-cover" alt="store" />
                            </div>
                            <div className="h-text">
                                <p className="h-h3">{shop.name}</p>
                                <div className="h-desc">
                                    {renderRatingStars(shop.averageRating)}
                                </div>
                                <div className="flex justify-between items-center">
                                    <div className="h-category">
                                        {renderLimitedCategories(shop.categories, 2, shop.name)}
                                    </div>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            {/* Available Shops Section */}
            <div className="mb-8">
                <h3 className="text-xl font-semibold mb-4">Available Shops</h3>
                <div className="h-content">
                    {isLoading ? (
                        <div className="flex justify-center items-center h-[60vh] w-[170vh]">
                            <div className="inline-block h-36 w-36 animate-spin rounded-full border-4 border-solid border-current border-r-transparent align-[-0.125em] motion-reduce:animate-[spin_1.5s_linear_infinite]" role="status">
                                <span className="!absolute !-m-px !h-px !w-px !overflow-hidden !whitespace-nowrap !border-0 !p-0 ![clip:rect(0,0,0,0)]">Loading...</span>
                            </div>
                        </div>
                    ) : (
                        shops.map((shop, index) => (
                            <div key={index} className="h-card" onClick={() => handleCardClick(shop.id)}>
                                <div className="h-img">
                                    <img src={shop.imageUrl} className="h-image-cover" alt="store" />
                                </div>
                                <div className="h-text">
                                    <p className="h-h3">{shop.name}</p>
                                    <div className="h-desc">
                                        {renderRatingStars(shop.averageRating)}
                                    </div>
                                    <div className="h-category">
                                        {renderLimitedCategories(shop.categories, 2, shop.name)}
                                    </div>
                                </div>
                            </div>
                        ))
                    )}
                </div>
            </div>
            
            <CategoriesModal 
                isOpen={showCategoriesModal}
                onClose={() => setShowCategoriesModal(false)}
                categories={selectedCategories}
                shopName={selectedShopName}
            />
        </div>
    );
}

export default Home;
