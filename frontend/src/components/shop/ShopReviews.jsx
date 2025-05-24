import { useState, useEffect } from "react"
import axios from "../../utils/axiosConfig"
import { useAuth } from "../../utils/AuthContext"


const ShopReviews = () => {
  const { currentUser } = useAuth()
  const [reviews, setReviews] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [averageRating, setAverageRating] = useState(0)
  const [orderItems, setOrderItems] = useState({})

  useEffect(() => {
    const fetchReviews = async () => {
      try {
        setLoading(true)
        // Fetch reviews for the current shop
        const response = await axios.get(`/ratings/shop/${currentUser.id}`)
        const reviewsData = response.data

        // Calculate average rating
        if (reviewsData.length > 0) {
          const totalRating = reviewsData.reduce((sum, review) => sum + review.rate, 0)
          setAverageRating((totalRating / reviewsData.length).toFixed(1))
        }

        setReviews(reviewsData)

        
        const orderDetailsPromises = reviewsData.map(async (review) => {
          try {
            const orderResponse = await axios.get(`/orders/${review.orderId}`)
            return { orderId: review.orderId, items: orderResponse.data.items }
          } catch (err) {
            console.error(`Error fetching order ${review.orderId}:`, err)
            return { orderId: review.orderId, items: [] }
          }
        })

        const orderDetails = await Promise.all(orderDetailsPromises)
        const orderItemsMap = {}
        orderDetails.forEach((detail) => {
          orderItemsMap[detail.orderId] = detail.items
        })

        setOrderItems(orderItemsMap)
        setError(null)
      } catch (err) {
        console.error("Error fetching reviews:", err)
        setError("Failed to load reviews. Please try again later.")
      } finally {
        setLoading(false)
      }
    }

    fetchReviews()
  }, [currentUser.id])

  const renderStars = (rating) => {
    return [...Array(5)].map((_, index) => (
      <span key={index} className={`text-xl ${index < rating ? "text-[#B94E4C]" : "text-[#DFD6C5]"}`}>
        ★
      </span>
    ))
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-[#DFD6C5] bg-opacity-30">
        <div className="flex justify-center items-center h-[90vh]">
          <div className="flex flex-col items-center gap-3">
            <div className="w-12 h-12 rounded-full border-4 border-[#DFD6C5] border-t-[#B94E4C] animate-spin"></div>
            <span className="text-[#B94E4C] font-medium">Loading reviews...</span>
          </div>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen bg-[#DFD6C5] bg-opacity-30 p-6">
        <div className="max-w-5xl mx-auto">
          <div className="text-center p-6 bg-white border-l-4 border-[#B94E4C] rounded-lg shadow-sm">
            <p className="text-[#B94E4C] font-medium">{error}</p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#DFD6C5] bg-opacity-30 p-4 md:p-6">
      <div className="max-w-5xl mx-auto">
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-[#B94E4C]">Customer Reviews</h1>
          <div className="h-1 w-20 bg-[#B94E4C] mt-2 rounded-full"></div>
        </div>

        <div className="bg-white rounded-lg shadow-md p-6 mb-6 border border-[#DFD6C5]">
          <div className="mb-4">
            <h2 className="text-xl font-semibold text-gray-800 mb-4 flex items-center">
              <span className="mr-2">Overall Rating</span>
              <div className="h-px flex-1 bg-[#DFD6C5]"></div>
            </h2>
            <div className="flex flex-col sm:flex-row sm:items-center gap-4">
              <div className="flex items-center">
                <div className="text-5xl font-bold mr-3 text-[#B94E4C]">{averageRating}</div>
                <div className="flex">{renderStars(Math.round(averageRating))}</div>
              </div>
              <div className="text-gray-600 font-medium">
                Based on {reviews.length} {reviews.length === 1 ? "review" : "reviews"}
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-md p-6 border border-[#DFD6C5]">
          <h2 className="text-xl font-semibold text-gray-800 mb-4 flex items-center">
            <span className="mr-2">All Reviews</span>
            <div className="h-px flex-1 bg-[#DFD6C5]"></div>
          </h2>

          {reviews.length === 0 ? (
            <div className="py-12 text-center">
              <div className="mx-auto w-16 h-16 mb-4 text-[#DFD6C5] text-4xl">📋</div>
              <p className="text-gray-500 text-lg">No reviews yet</p>
              <p className="text-gray-400">Reviews will appear here once customers rate your shop.</p>
            </div>
          ) : (
            <div className="space-y-6">
              {reviews.map((review, index) => (
                <div key={index} className="border-b border-[#DFD6C5] pb-6 last:border-b-0 last:pb-0">
                  <div className="flex flex-wrap items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <div className="flex">{renderStars(review.rate)}</div>
                      <div className="text-[#B94E4C] font-medium">{review.rate}/5</div>
                    </div>
                  </div>

                  {/* Order Items Section */}
                  {orderItems[review.orderId] && orderItems[review.orderId].length > 0 && (
                    <div className="mt-3 mb-4 bg-[#DFD6C5] bg-opacity-20 p-4 rounded-lg">
                      <p className="font-medium text-sm text-gray-700 mb-3 flex items-center">
                        <span className="mr-2 text-[#B94E4C]">📦</span>
                        Ordered Items
                      </p>
                      <div className="grid gap-3">
                        {orderItems[review.orderId].map((item, idx) => (
                          <div
                            key={idx}
                            className="flex items-center justify-between text-sm p-2 bg-white rounded-md shadow-sm"
                          >
                            <div className="flex items-center">
                              <div className="w-12 h-12 rounded-md overflow-hidden mr-3 border border-[#DFD6C5]">
                                <img
                                  src={item.imageUrl || "/Assets/Panda.png"}
                                  alt={item.name}
                                  className="w-full h-full object-cover"
                                />
                              </div>
                              <div>
                                <p className="font-medium text-gray-800">{item.name}</p>
                                <p className="text-gray-500">Qty: {item.quantity}</p>
                              </div>
                            </div>
                            <span className="font-medium text-[#B94E4C]">₱{item.price.toFixed(2)}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* User Review Section */}
                  <div className="mt-4 pt-4 bg-white rounded-lg">
                    <div className="flex items-center mb-3">
                      <div className="w-10 h-10 rounded-full overflow-hidden bg-[#DFD6C5] flex items-center justify-center mr-3 border border-[#DFD6C5]">
                        {review.userImage ? (
                          <img
                            src={review.userImage || "/placeholder.svg"}
                            alt={review.userName || "User"}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <div className="text-white text-sm font-bold">
                            {review.userName ? review.userName.charAt(0).toUpperCase() : "U"}
                          </div>
                        )}
                      </div>
                      <span className="font-semibold text-gray-800">{review.userName || "Anonymous"}</span>
                    </div>
                    <div className="bg-[#DFD6C5] bg-opacity-10 p-4 rounded-lg">
                      <p className="text-gray-700 italic">"{review.comment}"</p>
                    </div>
                    <div className="mt-3 text-xs text-gray-500 flex justify-between items-center">
                      <span>Order ID: {review.orderId}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default ShopReviews;