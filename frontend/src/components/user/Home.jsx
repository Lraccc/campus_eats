import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../utils/AuthContext";
import axios from "../../utils/axiosConfig";

import "../css/Home.css";

const Home = () => {
    const { currentUser } = useAuth();
    const navigate = useNavigate();
    const [shops, setShops] = useState([]);
    const [topShops, setTopShops] = useState([]);
    const [isLoading, setIsLoading] = useState(false);
    const [selectedCategory, setSelectedCategory] = useState(null);

    const categories = [
        { id: 1, name: 'Fast Food', icon: '🍔' },
        { id: 2, name: 'Cafes', icon: '☕' },
        { id: 3, name: 'Desserts', icon: '🍰' },
        { id: 4, name: 'Asian', icon: '🍜' },
        { id: 5, name: 'Healthy', icon: '🥗' },
    ];

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
        if (ratings.length === 0) return "No Ratings";
        const total = ratings.reduce((sum, rating) => sum + rating.rate, 0);
        const average = total / ratings.length;
        return average.toFixed(1);
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

    const handleCategoryClick = (category) => {
        setSelectedCategory(category === selectedCategory ? null : category);
    };

    const filteredShops = selectedCategory
        ? shops.filter(shop => shop.categories.includes(selectedCategory))
        : shops;

    return (
        <div className="h-body">
            <div className="h-title">
                <h2 className="font-semibold" style={{ fontSize: '24px' }}>
                    {getGreeting()}, {currentUser?.username}!
                </h2>
                <p>Start Simplifying Your Campus Cravings!</p>
            </div>

            {/* Categories Section */}
            <div className="mb-8">
                <h3 className="text-xl font-semibold mb-4">Categories</h3>
                <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                    {categories.map((category) => (
                        <div
                            key={category.id}
                            className={`bg-white p-4 rounded-lg shadow-md text-center cursor-pointer hover:shadow-lg transition-shadow ${
                                selectedCategory === category.name ? 'ring-2 ring-blue-500' : ''
                            }`}
                            onClick={() => handleCategoryClick(category.name)}
                        >
                            <span className="text-4xl mb-2 block">{category.icon}</span>
                            <span className="font-medium">{category.name}</span>
                        </div>
                    ))}
                </div>
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
                                <p className="h-desc">
                                    {shop.averageRating && shop.averageRating !== "No Ratings" 
                                        ? `★ ${shop.averageRating}` 
                                        : shop.desc}
                                </p>
                                <div className="flex justify-between items-center">
                                    <div className="h-category">
                                        {shop.categories.map((category, idx) => (
                                            <p className="h-p" key={idx}>{category}</p>
                                        ))}
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
                        filteredShops.map((shop, index) => (
                            <div key={index} className="h-card" onClick={() => handleCardClick(shop.id)}>
                                <div className="h-img">
                                    <img src={shop.imageUrl} className="h-image-cover" alt="store" />
                                </div>
                                <div className="h-text">
                                    <p className="h-h3">{shop.name}</p>
                                    <p className="h-desc">
                                        {shop.averageRating && shop.averageRating !== "No Ratings" 
                                            ? `★ ${shop.averageRating}` 
                                            : shop.desc}
                                    </p>
                                    <div className="h-category">
                                        {shop.categories.map((category, idx) => (
                                            <p className="h-p" key={idx}>{category}</p>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        ))
                    )}
                </div>
            </div>
        </div>
    );
}

export default Home;
