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

        // Fetch order details for each review
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
      <span key={index} className={index < rating ? "text-amber-400" : "text-gray-300"}>
        ★
      </span>
    ))
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-[#f8f5e9]">
        <div className="flex justify-center items-center h-[90vh]">
          <div
            className="inline-block h-12 w-12 animate-spin rounded-full border-4 border-solid border-[#c04a4a] border-r-transparent align-[-0.125em] motion-reduce:animate-[spin_1.5s_linear_infinite]"
            role="status"
          >
            <span className="!absolute !-m-px !h-px !w-px !overflow-hidden !whitespace-nowrap !border-0 !p-0 ![clip:rect(0,0,0,0)]">
              Loading...
            </span>
          </div>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen bg-[#f8f5e9] p-6">
        <div className="text-center p-4 bg-red-100 text-red-700 rounded-lg shadow-sm">{error}</div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#f8f5e9] p-6">
      <div className="max-w-5xl mx-auto">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-[#c04a4a]">Customer Reviews</h1>
        </div>

        <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
          <div className="mb-6">
            <h2 className="text-xl font-semibold text-gray-800 mb-4">Overall Rating</h2>
            <div className="flex items-center">
              <div className="text-4xl font-bold mr-3 text-gray-800">{averageRating}</div>
              <div className="flex text-2xl">{renderStars(Math.round(averageRating))}</div>
              <div className="ml-3 text-gray-600">
                ({reviews.length} {reviews.length === 1 ? "review" : "reviews"})
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm p-6">
          <h2 className="text-xl font-semibold text-gray-800 mb-4">All Reviews</h2>

          {reviews.length === 0 ? (
            <div className="py-8 text-center text-gray-500">
              <p>No reviews yet. Reviews will appear here once customers rate your shop.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {reviews.map((review, index) => (
                <div key={index} className="border-b border-gray-100 pb-4 last:border-b-0 last:pb-0">
                  <div className="flex items-center mb-2">
                    <div className="flex text-xl mr-2">{renderStars(review.rate)}</div>
                    <div className="text-gray-500 text-sm">{new Date(review.createdAt).toLocaleDateString()}</div>
                  </div>

                  {/* Order Items Section */}
                  {orderItems[review.orderId] && orderItems[review.orderId].length > 0 && (
                    <div className="mt-3 mb-3 bg-gray-50 p-3 rounded-md">
                      <p className="font-medium text-sm text-gray-700 mb-2">Ordered Items:</p>
                      <div className="space-y-1">
                        {orderItems[review.orderId].map((item, idx) => (
                          <div key={idx} className="flex justify-between text-sm">
                            <span className="text-gray-700">
                              {item.quantity}x {item.name}
                            </span>
                            <span className="font-medium">₱{item.price.toFixed(2)}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {review.comment && <p className="text-gray-700 my-2">{review.comment}</p>}
                  <div className="mt-2 text-xs text-gray-500">Order ID: {review.orderId}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default ShopReviews
