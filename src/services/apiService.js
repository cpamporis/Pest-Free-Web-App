// apiService.js 
import AsyncStorage from '@react-native-async-storage/async-storage';
import { normalizeAppointment } from "./normalizeAppointment";

export const API_BASE_URL = 
  "https://field-inspections-backend-production.up.railway.app/api";


let authToken = null;

// Load token from storage when module loads
(async () => {
  try {
    const token = await AsyncStorage.getItem('authToken');
    if (token) {
      authToken = token;
      console.log("🔑 Loaded token from AsyncStorage");
    }
  } catch (error) {
    console.error("❌ Failed to load token from storage:", error);
  }
})();


async function getEnhancedKPIs() {
  console.log("📊 Fetching enhanced KPIs from backend...");
  
  try {
    const result = await request("GET", "/statistics/kpis/enhanced");
    
    console.log("📊 Enhanced KPIs RAW API response:", result);
    console.log("📊 Enhanced KPIs parsed:", {
      success: result?.success,
      hasKPIData: !!result?.kpiData,
      retentionRate: result?.kpiData?.retentionRate,
      visitFrequency: result?.kpiData?.visitFrequency,
      revenueGrowth: result?.kpiData?.revenueGrowth,
      customerGrowth: result?.kpiData?.customerGrowth
    });
    
    return result;
  } catch (error) {
    console.error("❌ Failed to get enhanced KPIs:", error);
    return {
      success: false,
      kpiData: null
    };
  }
}

async function getTopPerformance() {
  console.log("🏆 Fetching top performance data...");
  
  try {
    const result = await request("GET", "/statistics/kpis/top-performance");
    
    console.log("🏆 Top performance response:", {
      success: result?.success,
      hasData: !!result?.performanceData
    });
    
    return result;
  } catch (error) {
    console.error("❌ Failed to get top performance:", error);
    return {
      success: false,
      performanceData: null
    };
  }
}

async function getRetentionRate(customerId = null) {
  console.log("📈 Fetching retention rate...");
  
  try {
    const endpoint = customerId 
      ? `/statistics/kpis/retention-rate?customerId=${customerId}`
      : `/statistics/kpis/retention-rate`;
    
    const result = await request("GET", endpoint);
    
    return result;
  } catch (error) {
    console.error("❌ Failed to get retention rate:", error);
    return {
      success: false,
      data: { retention_rate_percentage: 0 }
    };
  }
}

async function getVisitFrequency(customerId = null) {
  console.log("📈 Fetching visit frequency...");
  
  try {
    const endpoint = customerId 
      ? `/statistics/kpis/visit-frequency?customerId=${customerId}`
      : `/statistics/kpis/visit-frequency`;
    
    const result = await request("GET", endpoint);
    
    return result;
  } catch (error) {
    console.error("❌ Failed to get visit frequency:", error);
    return {
      success: false,
      data: { overall_avg_frequency_days: 30 }
    };
  }
}

// Set auth token and persist it
async function setAuthToken(token) {
  authToken = token;
  try {
    if (token) {
      await AsyncStorage.setItem('authToken', token);
      console.log("🔑 Token saved to AsyncStorage");
    } else {
      await AsyncStorage.removeItem('authToken');
      console.log("🔑 Token removed from AsyncStorage");
    }
  } catch (error) {
    console.error("❌ Failed to save token to storage:", error);
  }
}

// Clear auth token (for logout)
async function clearAuthToken() {
  authToken = null;
  try {
    await AsyncStorage.removeItem('authToken');
    console.log("🔑 Token cleared from storage");
  } catch (error) {
    console.error("❌ Failed to clear token:", error);
  }
}

// Get current token (useful for debugging)
function getCurrentToken() {
  return authToken;
}

// Helper function to verify token with backend
async function verifyTokenWithBackend(token) {
  console.log("🔍 Verifying token with backend...");
  
  try {
    const response = await fetch(`${API_BASE_URL}/verify-token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ token })
    });
    
    const result = await response.json();
    console.log("🔍 Token verification result:", result);
    return result;
  } catch (error) {
    console.error("❌ Token verification failed:", error);
    return { success: false, error: error.message };
  }
}

// Generic request wrapper
async function request(method, endpoint, body = null) {
  // Debug: Show current token state
  console.log(`🔑 Current token state for ${endpoint}:`, authToken ? "PRESENT" : "MISSING");
  console.log(`🌐 API CALL: ${method} ${API_BASE_URL}${endpoint}`);
  
  const options = {
    method,
    headers: {
      "Content-Type": "application/json",
      ...(authToken ? { Authorization: `Bearer ${authToken}` } : {})
    },
  };

  console.log(`📤 Headers for ${endpoint}:`, options.headers);

  if (body) options.body = JSON.stringify(body);

  try {
    console.log(`🌐 API Request: ${method} ${API_BASE_URL}${endpoint}`, body ? { body } : '');
    
    const res = await fetch(`${API_BASE_URL}${endpoint}`, options);

    // Get the raw text first
    const text = await res.text();
    console.log(`📥 RAW RESPONSE for ${endpoint}:`, text.substring(0, 300));
    
    let json;
    try {
      json = text ? JSON.parse(text) : null;
    } catch (parseError) {
      console.warn(`⚠️ Could not parse JSON for ${endpoint}:`, text);
      json = null;
    }

    console.log(`📥 API Response for ${endpoint}:`, { 
      status: res.status, 
      ok: res.ok,
      data: json 
    });

    if (!res.ok) {
      return { 
        success: false, 
        error: json?.error || `Request failed with status ${res.status}`,
        status: res.status,
        data: json
      };
    }

    // Return the parsed JSON directly (not wrapped in {data: ...})
    return json || { success: true };

  } catch (err) {
    console.error(`❌ API Error for ${endpoint}:`, err);
    return { 
      success: false, 
      error: err.message,
      networkError: true 
    };
  }
}

const apiService = {
  // TOKEN MANAGEMENT
  setAuthToken,
  clearAuthToken,
  getCurrentToken,
  verifyTokenWithBackend,
  request,
  getEnhancedKPIs,
  getTopPerformance,
  getRetentionRate,
  getVisitFrequency,
  updateRescheduleStatus(appointmentId, payload) {
    return apiService.updateAppointmentRescheduleStatus(appointmentId, payload);
  },

  async getTotalRequestsToday() {
    try {
      console.log("📊 Fetching TOTAL requests created today...");
      
      // Try the new endpoint for total count
      const result = await request("GET", "/customer-requests/today-total-count");
      
      if (result?.success) {
        console.log(`✅ Total requests today: ${result.count}`);
        return result;
      }
      
      // Fallback to the old endpoint
      console.log("🔄 Falling back to pending-only count...");
      const pendingResult = await getTodayCustomerRequestsCount();
      return pendingResult;
      
    } catch (error) {
      console.error("❌ Error getting total requests today:", error);
      return { success: false, count: 0, error: error.message };
    }
  },

  async getTotalRequestsCreatedToday() {
    try {
      console.log("📊 Fetching TOTAL requests created today...");
      
      // Use the working method instead of direct endpoint
      return await this.getTotalRequestsToday();
      
    } catch (error) {
      console.error("❌ Error getting total requests today:", error);
      return { success: false, count: 0, error: error.message };
    }
  },

  // Customer Requests
  async submitCustomerRequest(requestData) {
    console.log("📤 Submitting customer request:", requestData);
    
    const result = await request("POST", "/customer-requests", requestData);
    
    console.log("📥 Customer request response:", result);
    
    return result;
  },

  async getCustomerRequests(status = null) {
    const endpoint = status ? `/customer-requests?status=${status}` : "/customer-requests";
    return request("GET", endpoint);
  },

  // Update the getTodayCustomerRequestsCount method in apiService.js
async getTodayCustomerRequestsCount() {
  // Add cache-busting parameter
  const timestamp = Date.now();
  const res = await request("GET", `/admin/customer-requests/today-count?t=${timestamp}`);

  if (!res || res.success === false) {
    return { success: false, count: 0 };
  }

  return res;
},


  async updateCustomerRequestStatus(requestId, status, appointmentId = null, notes = null) {
    return request("PUT", `/customer-requests/${requestId}/status`, {
      status,
      appointmentId,
      notes
    });
  },

  async getCustomerMyRequests() {
    return request("GET", "/customer/my-requests");
  },

  async submitRescheduleRequest(rescheduleData) {
    console.log("📤 Submitting reschedule request:", rescheduleData);
    
    const result = await request("POST", "/customer/reschedule-request", rescheduleData);
    
    console.log("📥 Reschedule request response:", result);
    
    return result;
  },

  async updateRescheduleStatus(appointmentId, payload) {
    console.log("🔄 updateAppointmentRescheduleStatus CALLED with:", {
      appointmentId,
      payload
    });

    try {
      const result = await request(
        "PUT",
        `/appointments/${appointmentId}/reschedule-status`,
        payload
      );

      console.log("✅ Reschedule status update response:", result);
      return result;

    } catch (error) {
      console.error("❌ Reschedule status update failed:", error);
      return {
        success: false,
        error: error.message || "Failed to update appointment reschedule status"
      };
    }
  },

  // NOTIFICATION ENDPOINTS
  async getCustomerNotifications() {
    try {
      console.log("📢 Fetching customer notifications from API...");
      
      const result = await request("GET", "/customer/notifications");
      
      console.log("📢 Notifications API response:", {
        success: result?.success,
        count: result?.notifications?.length || 0,
        unreadCount: result?.unreadCount || 0
      });
      
      return result;
    } catch (error) {
      console.error("❌ Failed to fetch notifications:", error);
      return {
        success: false,
        notifications: [],
        unreadCount: 0
      };
    }
  },

  async markNotificationAsRead(notificationId) {
    return request("PATCH", `/notifications/${notificationId}/read`);
  },

  async markAllNotificationsAsRead() {
    return request("POST", "/notifications/mark-all-read");
  },

  async clearAllNotifications() {
    return request("DELETE", "/notifications/clear");
  },

  async cancelAppointment(appointmentId) {
    return request("PUT", `/appointments/${appointmentId}/cancel`);
  },
  // LOGIN
  async login(email, password) {
    console.log("🔐 Attempting login for:", email);
    
    const result = await request("POST", "/login", { email, password });

    console.log("🔑 Login result:", {
      success: result?.success,
      role: result?.role,
      hasToken: !!result?.token
    });

    if (!result || !result.success) {
      return result;
    }

    // Set the token immediately upon successful login
    if (result.token) {
      await setAuthToken(result.token);
      
      // Verify token was set
      const currentToken = getCurrentToken();
      console.log("✅ Token set in apiService:", currentToken ? "YES" : "NO");
      
      // Test the token immediately
      if (currentToken) {
        console.log("🔍 Testing token with backend...");
        const verification = await verifyTokenWithBackend(currentToken);
        console.log("🔍 Token verification result:", verification.success ? "✅ VALID" : "❌ INVALID");
        
        if (!verification.success) {
          console.error("❌ Token is invalid! Clearing...");
          await clearAuthToken();
          return {
            success: false,
            error: "Token validation failed. Please try again."
          };
        }
      }
    }

    if (result.role === "admin") {
      return {
        success: true,
        role: "admin",
        token: result.token
      };
    }

    if (result.role === "tech" && result.technician) {
      return {
        success: true,
        role: "tech",
        token: result.token,
        technician: result.technician
      };
    }

    if (result.role === "customer" && result.customer) {
      return {
        success: true,
        role: "customer",
        token: result.token,
        customer: result.customer
      };
    }

    return { success: false, error: "Invalid credentials" };
  },
  async getCustomerStats() {
    console.log("📊 API: Getting customer stats...");

    const res = await request("GET", "/customers/stats");

    console.log("📥 Customer stats API response:", res);

    // Handle failure
    if (!res || res.success === false) {
      console.error("❌ Customer stats API error:", res?.error);
      return { stats: [] };
    }

    // Expected format: { success: true, stats: [...] }
    if (res.stats && Array.isArray(res.stats)) {
      return res;
    }

    console.warn("⚠️ Unexpected customer stats response format:", res);
    return { stats: [] };
  },
  // CUSTOMERS
  async getCustomers() {
    console.log("🌐 API: Getting customers...");
    
    // Try the generic endpoint
    const res = await request("GET", "/customers");

    console.log("📥 Raw customers API response:", res);
    
    // If request returns an error object
    if (res && res.success === false) {
      console.error("❌ Customers API error:", res.error);
      return [];
    }
    
    // Handle different response formats
    let customersArray = [];
    
    if (Array.isArray(res)) {
      console.log("✅ Direct array response");
      customersArray = res;
    } else if (res && Array.isArray(res.data)) {
      console.log("✅ Using res.data array");
      customersArray = res.data;
    } else if (res && Array.isArray(res.customers)) {
      console.log("✅ Using res.customers array");
      customersArray = res.customers;
    } else if (res && res.success && res.data && Array.isArray(res.data)) {
      console.log("✅ Using res.success.data array");
      customersArray = res.data;
    }
    
    console.log(`✅ Found ${customersArray.length} customers`);
    
    // Format customers consistently
    const formattedCustomers = customersArray.map(c => ({
      customerId: String(c.customerId ?? c.id ?? c.customer_id ?? ''),
      customerName: c.customerName ?? c.name ?? c.customer_name ?? 'Unknown Customer',
      email: c.email ?? '',
      address: c.address ?? '',
      telephone: c.telephone ?? '',
      complianceValidUntil: c.complianceValidUntil ?? c.compliance_valid_until ?? null,
      maps: Array.isArray(c.maps) ? c.maps : []
    }));
    
    console.log("✅ Formatted customers:", formattedCustomers.length);
    
    return formattedCustomers;
  },
  
  async getCustomerById(id) {
    return request("GET", `/customers/${id}`);
  },

  async createCustomer(data) {
    return request("POST", "/customers", data);
  },

  async updateCustomer(id, data) {
    console.log("📝 Updating customer:", id, data);
    
    return request("PUT", `/customers/${id}`, data);
  },

  async getCustomerDetails(id) {
    console.log("🔍 Getting customer details for:", id);
    
    const result = await request("GET", `/customers/${id}`);
    
    console.log("📥 Customer details response:", {
      success: result?.success,
      hasData: !!result?.data,
      customerId: result?.data?.customerId || result?.customerId
    });
    
    return result;
  },
  async getCustomerVisits(customerId) {
  if (!customerId) {
    console.warn("⚠️ getCustomerVisits called without customerId");
    return [];
  }

  console.log("📋 Fetching ADMIN customer visits for:", customerId);

  const res = await request(
    "GET",
    `/appointments/customer/${customerId}`
  );

  console.log("📥 getCustomerVisits response:", res);

  if (!res || res.success !== true) {
    console.warn("⚠️ getCustomerVisits failed:", res);
    return [];
  }

  return Array.isArray(res.visits) ? res.visits : [];
},


  async deleteCustomer(id) {
    return request("DELETE", `/customers/${id}`);
  },

  async getCustomerWithMaps(id) {
    console.log("📱 getCustomerWithMaps called for id:", id);
    
    const result = await request("GET", `/customers/${id}`);
    
    // Handle different response structures consistently
    let customerData = null;
    
    if (result?.success === true && result.data) {
      // Format: {success: true, data: {...}}
      customerData = result.data;
    } else if (result?.customerId) {
      // Format: direct customer object
      customerData = result;
    } else if (result?.data?.customerId) {
      // Format: {data: {...}}
      customerData = result.data;
    } else {
      console.error("❌ Invalid customer data structure:", result);
      // Return a valid structure with empty maps array
      return {
        customerId: id,
        customerName: "Unknown Customer",
        address: "",
        email: "",
        maps: []
      };
    }
    
    // Ensure maps is always an array
    if (!Array.isArray(customerData.maps)) {
      customerData.maps = [];
    }
    
    return customerData; // ALWAYS return the customer object directly
  },

  // TECHNICIANS
  async getTechnicians() {
    console.log("🌐 API: Getting technicians...");
    
    const res = await request("GET", "/admin/technicians");

    console.log("📥 Technicians API response:", {
      success: res?.success,
      type: typeof res,
      isArray: Array.isArray(res),
      hasTechnicians: !!res?.technicians,
      techniciansType: typeof res?.technicians,
      techniciansIsArray: Array.isArray(res?.technicians),
      fullResponse: res
    });

    if (!res) return [];
    
    // Handle different response formats
    if (Array.isArray(res)) {
      console.log("✅ Technicians response is direct array");
      return res;
    } else if (res.technicians && Array.isArray(res.technicians)) {
      console.log("✅ Technicians found in .technicians property");
      return res.technicians;
    } else if (res.success && Array.isArray(res.data)) {
      console.log("✅ Technicians found in .data property");
      return res.data;
    } else if (res.success === false) {
      console.error("❌ Technicians API returned error:", res.error);
      return [];
    }
    
    console.warn("⚠️ Unexpected technicians response format:", res);
    return [];
  },

  async getTechnicianById(id) {
    return request("GET", `/technicians/${id}`);
  },

  async createTechnician(data) {
    return request("POST", "/technicians", data);
  },

  async updateTechnician(id, data) {
    return request("PUT", `/technicians/${id}`, data);
  },

  async deleteTechnician(id) {
    return request("DELETE", `/technicians/${id}`);
  },

  // TODAY'S VISITS
  async getTodaysVisits() {
    return request("GET", "/today-visits");
  },

  // APPOINTMENT METHODS
  async rescheduleAppointment(appointmentId, rescheduleData) {
    try {
      console.log("🔄 Rescheduling appointment:", {
        appointmentId,
        newDate: rescheduleData.requestedDate,
        newTime: rescheduleData.requestedTime
      });
      
      const updatePayload = {
        date: rescheduleData.requestedDate,
        time: rescheduleData.requestedTime,
        status: 'pending_reschedule',
        rescheduleNotes: rescheduleData.description || '',
        rescheduleRequestedAt: new Date().toISOString()
      };
      
      const result = await request("PUT", `/appointments/${appointmentId}/reschedule`, updatePayload);
      
      console.log("🔄 Reschedule appointment result:", result);
      
      return result;
      
    } catch (error) {
      console.error("❌ Failed to reschedule appointment:", error);
      return { success: false, error: error.message };
    }
  },

  async createAppointment(payload) {
    console.log("📤 FULL PAYLOAD received by createAppointment:", payload);
    
    // 🚨 ADD THIS DEBUG LOG:
    console.log("🔍 DEBUG API - servicePrice in payload:", {
      hasServicePrice: 'servicePrice' in payload,
      servicePriceValue: payload.servicePrice,
      servicePriceType: typeof payload.servicePrice
    });

    const appointmentData = {
      technicianId: payload.technicianId,
      customerId: payload.customerId || null,
      legacyCustomerKey: payload.legacyCustomerKey || null,
      date: payload.date || payload.appointmentDate,
      time: payload.time || payload.appointmentTime,
      serviceType: payload.serviceType,
      status: payload.status || "scheduled",
      specialServiceSubtype: payload.specialServiceSubtype || null,
      otherPestName: payload.otherPestName || null,
      appointmentCategory: payload.appointmentCategory || null,
      insecticideDetails: payload.insecticideDetails || null,
      disinfection_details: payload.disinfection_details || null
    };

    if (payload.compliance_valid_until) {
      appointmentData.compliance_valid_until = payload.compliance_valid_until;
      console.log(
        "✅ DEBUG API - Added compliance_valid_until:",
        payload.compliance_valid_until
      );
    }

    // 🚨 CRITICAL: Make sure this is UNCOMMENTED
    if (payload.servicePrice !== undefined) {
      appointmentData.servicePrice = payload.servicePrice;
      console.log("✅ DEBUG API - Added servicePrice to appointmentData:", payload.servicePrice);
    } else {
      console.log("❌ DEBUG API - servicePrice is undefined in payload!");
    }

    if (payload.insecticideDetails) {
      appointmentData.insecticideDetails = payload.insecticideDetails;
    }
    
    if (payload.disinfection_details) {
      appointmentData.disinfection_details = payload.disinfection_details;
    }

    console.log("🔍 DEBUG API - Final appointmentData:", appointmentData);
    
    const result = await request("POST", "/appointments", appointmentData);
    
    return result;
  },

  async getCustomerAppointments() {
    return request("GET", "/customer/appointments");
  },

  async getAppointments(params = {}) {
    const query = new URLSearchParams(params).toString();
    const endpoint = query ? `/appointments?${query}` : `/appointments`;

    console.log("🔍 Fetching appointments with params:", params);
    
    const res = await request("GET", endpoint);
    
    console.log("📊 Raw appointments response from request():", res);
    
    let appointmentsArray;
    
    if (Array.isArray(res)) {
      appointmentsArray = res;
    } else if (res && Array.isArray(res.appointments)) {
      appointmentsArray = res.appointments;
    } else if (res && res.success && Array.isArray(res.data)) {
      appointmentsArray = res.data;
    } else {
      console.warn("⚠️ Unexpected appointments response format:", res);
      appointmentsArray = [];
    }
    
    console.log(`✅ Extracted ${appointmentsArray.length} appointments`);
    
    return appointmentsArray.map(normalizeAppointment);
  },

  async updateAppointment(appointmentData) {
    console.log("📝 Updating appointment:", appointmentData);
  
    // Handle both formats: appointmentData can be an object with id property OR separate id and updates
    let appointmentId;
    let payload;
    
    if (typeof appointmentData === 'string') {
      // Old format: updateAppointment(id, updates)
      appointmentId = appointmentData;
      payload = arguments[1] || {};
    } else if (typeof appointmentData === 'object') {
      // New format: updateAppointment({id, status, visitId, etc.})
      appointmentId = appointmentData.id;
      payload = { ...appointmentData };
      delete payload.id; // Remove id from payload
    } else {
      console.error("❌ Invalid appointmentData format:", appointmentData);
      return { success: false, error: "Invalid appointment data format" };
    }
    
    console.log("🔍 DEBUG API - updateAppointment called with:", {
      appointmentId,
      payload
    });

    if (!appointmentId) {
      console.error("❌ No appointment ID provided");
      return { success: false, error: "Appointment ID is required" };
    }

    const result = await request(
      "PUT",
      `/appointments/${appointmentId}`,
      payload
    );

    console.log("📥 Update appointment result:", result);
    return result;
  },

  async deleteAppointment(appointmentId) {
    console.log("🗑️ Deleting appointment:", appointmentId);
    return request("DELETE", `/appointments/${appointmentId}`);
  },

  async getAppointmentsForCustomer(customerId) {
    if (!customerId) {
      console.error("❌ No customerId provided");
      return [];
    }
    
    console.log(`📅 Getting appointments for customer: ${customerId}`);
    
    try {
      const response = await request("GET", `/appointments?customerId=${customerId}`);
      
      if (Array.isArray(response)) {
        return response;
      } else if (response?.appointments) {
        return response.appointments;
      } else if (response?.success && Array.isArray(response.data)) {
        return response.data;
      }
      
      return [];
    } catch (error) {
      console.error("❌ Error getting appointments for customer:", error);
      return [];
    }
  },

  // MATERIALS (bait types + chemicals)
  async getBaitTypes() {
    console.log("🌐 API: Getting bait types...");
    
    try {
      const res = await request("GET", "/materials/bait-types");

      console.log("📥 Bait Types API RAW RESPONSE:", {
        response: res,
        type: typeof res,
        isArray: Array.isArray(res),
        hasBaitTypes: !!res?.baitTypes,
        hasSuccess: res?.success,
        fullResponse: JSON.stringify(res, null, 2)
      });

      // 🚨 FIX: Your backend returns {success: true, baitTypes: [...]}
      if (res?.success === true && Array.isArray(res.baitTypes)) {
        console.log("✅ Found baitTypes array:", res.baitTypes.length);
        return res.baitTypes; // Return the array directly
      }
      
      // Alternative format: direct array
      if (Array.isArray(res)) {
        console.log("✅ Response is direct array:", res.length);
        return res;
      }
      
      // Alternative format: {baitTypes: [...]} without success
      if (Array.isArray(res?.baitTypes)) {
        console.log("✅ Found baitTypes in object:", res.baitTypes.length);
        return res.baitTypes;
      }
      
      // Alternative format: {success: true, data: [...]}
      if (res?.success === true && Array.isArray(res.data)) {
        console.log("✅ Found data array:", res.data.length);
        return res.data;
      }
      
      // Alternative format: {success: true, types: [...]}
      if (res?.success === true && Array.isArray(res.types)) {
        console.log("✅ Found types array:", res.types.length);
        return res.types;
      }
      
      console.warn("⚠️ Unexpected bait types response format:", res);
      return [];
      
    } catch (error) {
      console.error("❌ Error in getBaitTypes:", error);
      return [];
    }
  },

  async postBaitTypes(types) {
    return request("POST", "/materials/bait-types", { baitTypes: types });
  },

  async getChemicals() {
    console.log("🌐 API: Getting chemicals...");
    
    const res = await request("GET", "/materials/chemicals");

    console.log("📥 Chemicals API response:", {
      success: res?.success,
      hasChemicals: !!res?.chemicals,
      chemicalsType: typeof res?.chemicals,
      chemicalsIsArray: Array.isArray(res?.chemicals),
      fullResponse: res
    });

    if (!res) return [];
    
    // Handle different response formats
    if (Array.isArray(res)) {
      console.log("✅ Chemicals response is direct array");
      return res;
    } else if (res.chemicals && Array.isArray(res.chemicals)) {
      console.log("✅ Chemicals found in .chemicals property");
      return res.chemicals;
    } else if (res.success && Array.isArray(res.data)) {
      console.log("✅ Chemicals found in .data property");
      return res.data;
    } else if (res.success === false) {
      console.error("❌ Chemicals API returned error:", res.error);
      return [];
    }
    
    console.warn("⚠️ Unexpected chemicals response format:", res);
    return [];
  },

  async postChemicals(chemicals) {
    return request("POST", "/materials/chemicals", { chemicals: chemicals });
  },

  async deleteCustomerMap(customerId, mapId) {
    return request("DELETE", `/customers/${customerId}/maps/${mapId}`);
  },

  // REPORTS
  async getVisitReport(visitId) {
    return request("GET", `/reports/visit/${visitId}`);
  },

  // CUSTOMER ENDPOINTS
  async getCustomerDashboard() {
    try {
      console.log("📊 Getting customer dashboard...");
      
      const result = await request("GET", "/customer/dashboard");
      
      console.log("📊 Dashboard API response:", {
        success: result?.success,
        hasNextAppointment: !!result?.nextAppointment,
        nextAppointmentDate: result?.nextAppointment?.date,
        upcomingCount: result?.upcomingAppointments?.length || 0
      });
      
      if (result?.success) {
        return result;
      } else {
        console.error("❌ Dashboard API returned unsuccessful:", result);
        return {
          success: false,
          error: result?.error || "Failed to load dashboard",
          customer: null,
          nextAppointment: null,
          upcomingAppointments: []
        };
      }
    } catch (error) {
      console.error("❌ getCustomerDashboard error:", error);
      return {
        success: false,
        error: error.message,
        customer: null,
        nextAppointment: null,
        upcomingAppointments: []
      };
    }
  },

  async validateAppointmentDate(appointment) {
    if (!appointment || !appointment.date) {
      return { valid: false, reason: "No date provided" };
    }
    
    try {
      const appointmentDate = new Date(appointment.date);
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      appointmentDate.setHours(0, 0, 0, 0);
      
      console.log("📅 Date validation:", {
        appointmentDate: appointmentDate.toISOString(),
        today: today.toISOString(),
        isValid: appointmentDate >= today
      });
      
      return {
        valid: appointmentDate >= today,
        isToday: appointmentDate.getTime() === today.getTime(),
        formattedDate: appointmentDate.toLocaleDateString('en-US'),
        rawDate: appointment.date
      };
    } catch (error) {
      console.error("❌ Date validation error:", error);
      return { valid: false, reason: "Invalid date format" };
    }
  },

  async createCustomerLogin(customerId, data) {
    return request("POST", `/customers/${customerId}/create-login`, data);
  },

  // In apiService.js - changeCustomerPassword method
  async changeCustomerPassword(currentPassword, newPassword) {
    try {
      console.log("🔐 API: Changing customer password...");
      
      const response = await request("POST", "/customer/change-password", {
        currentPassword,
        newPassword
      });
      
      console.log("🔐 Password change API response:", {
        success: response?.success,
        error: response?.error
      });
      
      return response;
    } catch (error) {
      console.error("❌ Change password API error:", error);
      
      // Don't throw the error - return it in a structured way
      return {
        success: false,
        error: error.message || "Failed to change password"
      };
    }
  },

  async getCustomerActualVisits(customerId) {
    if (!customerId) {
      console.warn("⚠️ getCustomerActualVisits called without customerId");
      return [];
    }

    console.log("📋 Fetching ACTUAL visits for:", customerId);

    try {
      const res = await request("GET", `/visits/customer/${customerId}`);

      console.log("📥 getCustomerActualVisits response:", {
        success: res?.success,
        count: res?.visits?.length || 0,
        hasVisits: !!res?.visits
      });

      if (!res || res.success !== true) {
        console.warn("⚠️ getCustomerActualVisits failed:", res?.error);
        return [];
      }

      return Array.isArray(res.visits) ? res.visits : [];
      
    } catch (error) {
      console.error("❌ getCustomerActualVisits error:", error);
      return [];
    }
  },

  // Logging methods
  async logBaitStation(data) {
  console.log("🚨 logBaitStation received data:", data);

  const stationData = {
    timestamp: data.timestamp,
    customerId: data.customerId,
    customerName: data.customerName || '',
    stationId: data.stationId,
    stationType: "BS", // Make sure this is always "BS"
    consumption: data.consumption || '',
    baitType: data.baitType || '',
    condition: data.condition || '',
    access: data.access || '',
    technicianId: data.technicianId,
    technicianName: data.technicianName || '',
    appointmentId: data.appointmentId || '',
    visitId: data.visitId,
    isVisitSummary: false
  };

  console.log("📦 Sending stationData to backend:", stationData);

  // 🚨 FIX: Use the correct endpoint for saving stations
  // Try multiple endpoints to find the right one
  try {
    // First try /station-logs (most logical)
    console.log("🔄 Trying /station-logs endpoint...");
    const result = await request("POST", "/station-logs", stationData);
    
    if (result?.success) {
      console.log("✅ Station saved via /station-logs");
      return result;
    }
  } catch (error) {
    console.warn("⚠️ /station-logs failed, trying /log-station...");
  }
  
  try {
    // Try /log-station (alternative)
    const result = await request("POST", "/log-station", stationData);
    if (result?.success) {
      console.log("✅ Station saved via /log-station");
      return result;
    }
  } catch (error) {
    console.warn("⚠️ /log-station failed, trying /log...");
  }
  
  // Last resort: try /log with different structure
  try {
    const fallbackData = {
      ...stationData,
      action: 'station-log',
      serviceType: 'myocide'
    };
    const result = await request("POST", "/log", fallbackData);
    console.log("📥 /log fallback response:", result);
    return result;
  } catch (error) {
    console.error("❌ All endpoints failed:", error);
    return { 
      success: false, 
      error: "No endpoint available to save station data" 
    };
  }
},

  async logService(serviceData) {
    console.log("📱 Sending service completion:", {
      customerId: serviceData.customerId,
      serviceType: serviceData.serviceType,
      technicianId: serviceData.technicianId,
      visitId: serviceData.visitId,
      insecticideDetails: serviceData.insecticideDetails, // Log this
      otherPestName: serviceData.otherPestName // Log this too
    });

    const formattedChemicals = serviceData.chemicalsUsed?.map(chem => {
      if (typeof chem === 'string') {
        return { name: chem, concentration: '', volume: '' };
      } else if (chem && typeof chem === 'object') {
        return {
          name: chem.name || chem.chemicalName || '',
          concentration: chem.concentration || chem.concentrationPercent || '',
          volume: chem.volume || chem.volumeMl || ''
        };
      }
      return { name: '', concentration: '', volume: '' };
    }).filter(chem => chem.name) || [];

    const formattedData = {
      ...serviceData,
      chemicalsUsed: formattedChemicals,
      // Ensure these fields are included
      insecticideDetails: serviceData.insecticideDetails || null,
      otherPestName: serviceData.otherPestName || null,
      disinfection_details: serviceData.disinfection_details || null,
      work_type: serviceData.work_type || null
    };

    const result = await request("POST", "/log-service", formattedData);
    
    if (result?.success) {
      console.log("✅ Service logged to backend successfully");
      return result;
    } else {
      console.error("❌ Failed to log service:", result?.error);
      throw new Error(result?.error || "Failed to save service");
    }
  },

  async getServiceLogByVisitId(visitId) {
    console.log("🔍 Fetching service log for visitId:", visitId);
    
    try {
      // Try the service-logs endpoint first
      const result = await this.request("GET", `/service-logs/${visitId}`);
      
      console.log("📥 Service logs endpoint response:", {
        success: result?.success,
        hasLog: !!result?.log,
        hasReport: !!result?.report,
        dataType: typeof result
      });
      
      if (result?.success && result.log) {
        console.log("✅ Service log found in service-logs endpoint");
        return result;
      }
      
      console.log("🔄 Trying reports endpoint as fallback...");
      const reportResult = await this.request("GET", `/reports/visit/${visitId}`);
      
      console.log("📥 Reports endpoint response:", {
        success: reportResult?.success,
        hasReport: !!reportResult?.report,
        dataType: typeof reportResult
      });
      
      if (reportResult?.success && reportResult.report) {
        console.log("✅ Found service log in reports");
        return {
          success: true,
          log: reportResult.report,
          report: reportResult.report
        };
      }
      
      // 🚨 NEW: Try visits endpoint for myocide data
      console.log("🔄 Trying visits endpoint...");
      try {
        const visitResult = await this.request("GET", `/visits/${visitId}`);
        console.log("📥 Visits endpoint response:", visitResult);
        
        if (visitResult?.success && visitResult.visit) {
          console.log("✅ Found visit data");
          
          // Format visit data as a service log
          const formattedLog = {
            visit_id: visitResult.visit.id,
            customer_name: visitResult.visit.customer_name,
            technician_name: visitResult.visit.technician_name,
            start_time: visitResult.visit.start_time,
            duration: visitResult.visit.duration,
            service_type: 'myocide',
            work_type: visitResult.visit.work_type,
            notes: visitResult.visit.notes,
            created_at: visitResult.visit.created_at,
            updated_at: visitResult.visit.updated_at
          };
          
          return {
            success: true,
            log: formattedLog,
            report: formattedLog
          };
        }
      } catch (visitError) {
        console.warn("⚠️ Visits endpoint failed:", visitError.message);
      }
      
      console.log("❌ No service log found for visitId:", visitId);
      return {
        success: false,
        error: "Service log not found"
      };
      
    } catch (error) {
      console.error("❌ Error in getServiceLogByVisitId:", error);
      return {
        success: false,
        error: error.message
      };
    }
  },

  async getCustomerVisitHistory() {
    console.log("📋 Getting customer visit history...");
    
    try {
      const result = await request("GET", "/customer/visits");
      
      console.log("📥 Customer visit history response:", {
        success: result?.success,
        count: result?.visits?.length || 0,
        hasVisits: !!result?.visits
      });
      
      return result;
    } catch (error) {
      console.error("❌ Failed to get customer visit history:", error);
      return {
        success: false,
        error: error.message,
        visits: []
      };
    }
  },

  async getVisitByAppointmentId(appointmentId) {
    console.log("🔍 Resolving visitId for appointmentId:", appointmentId);

    if (!appointmentId) {
      return { success: false, visitId: null };
    }

    return request("GET", `/visits/by-appointment/${appointmentId}`);
  },
  
  async getVisitIdByAppointmentId(appointmentId) {
    try {
      const response = await fetch(`${API_BASE_URL}/visits/by-appointment/${appointmentId}`);
      const data = await response.json();
      
      if (data.success && data.visitId) {
        return data.visitId;
      }
      return null;
    } catch (error) {
      console.error("Error getting visitId by appointment:", error);
      return null;
    }
  },

  async getBaitTypeNames() {
    try {
      const result = await this.getBaitTypes();
      if (result?.success && Array.isArray(result.types)) {
        return result.types.map(item => 
          typeof item === 'string' ? item : (item.name || item)
        );
      }
      return [];
    } catch (error) {
      console.error("Error getting bait type names:", error);
      return [];
    }
  },

  async getChemicalNames() {
    try {
      const result = await this.getChemicals();
      if (result?.success && Array.isArray(result.chemicals)) {
        return result.chemicals.map(item => 
          typeof item === 'string' ? item : (item.name || item)
        );
      }
      return [];
    } catch (error) {
      console.error("Error getting chemical names:", error);
      return [];
    }
  },

  async requestReschedule(appointmentId, data) {
    console.log("🔄 Requesting reschedule for appointment:", appointmentId);
    console.log("📤 Reschedule data:", data);
    
    try {
      const result = await request("PUT", `/appointments/${appointmentId}/reschedule`, data);
      
      console.log("📥 Reschedule request response:", result);
      
      return result;
    } catch (error) {
      console.error("❌ Error requesting reschedule:", error);
      return {
        success: false,
        error: error.message || "Failed to submit reschedule request"
      };
    }
  },
  
  async logVisitSummary(data) {
    const visitData = {
      startTime: data.startTime,
      endTime: data.endTime,
      duration: data.duration,
      customerId: data.customerId,
      customerName: data.customerName,
      technicianId: data.technicianId,
      technicianName: data.technicianName,
      totalStations: data.stationData?.totalStations || 0,
      loggedStations: data.stationData?.loggedStations || 0,
      appointmentId: data.appointmentId || '',
      workType: data.workType || 'Manual Visit',
      visitId: data.visitId,
      isVisitSummary: true
    };
    
    return request("POST", "/log", visitData);
  },

  async saveMapStations(mapId, stations) {
    console.log("📍 Saving stations for map:", mapId);
    console.log("📦 Stations data:", stations);
    
    return request("PUT", `/maps/${mapId}/stations`, { stations });
  },

  async logCompleteVisit(visitSummary, stations) {
    const completeData = {
      visitSummary,
      stations,
      action: 'complete-visit'
    };
    
    console.log("📤 Sending complete visit data:", {
      visitSummary: {
        ...visitSummary,
        startTime: new Date(visitSummary.startTime).toISOString(),
        endTime: new Date(visitSummary.endTime).toISOString()
      },
      stationsCount: stations.length,
      stationsSample: stations.slice(0, 3)
    });
    
    try {
      // Try the correct endpoint
      const result = await request("POST", "/visits/log-complete", completeData);
      
      console.log("📥 /visits/log-complete response:", {
        success: result?.success,
        visitId: result?.visitId,
        message: result?.message,
        fullResponse: result
      });
      
      if (!result) {
        throw new Error("No response from server");
      }
      
      // Check if we got a success response
      if (result.success === true) {
        return result;
      }
      
      // If not successful, check for error
      if (result.success === false) {
        throw new Error(result.error || "Save failed");
      }
      
      // Some endpoints might not have 'success' property
      if (result.visitId) {
        return { success: true, ...result };
      }
      
      throw new Error("Unexpected response format");
      
    } catch (error) {
      console.error("❌ logCompleteVisit error:", error);
      
      // Provide a more helpful error message
      const errorMessage = error.message || "Failed to save visit";
      
      // Check if it's a network error
      if (error.networkError) {
        throw new Error("Network error: Please check your internet connection");
      }
      
      // Check if endpoint doesn't exist
      if (error.message.includes('404') || error.message.includes('Not Found')) {
        console.warn("⚠️ /visits/log-complete endpoint not found");
        
        // Try alternative: Fallback to old /log endpoint
        try {
          console.log("🔄 Trying fallback to /log endpoint...");
          
          const visitData = {
            ...visitSummary,
            isVisitSummary: true,
            stationData: {
              totalStations: stations.length,
              loggedStations: stations.length
            }
          };
          
          const fallbackResult = await request("POST", "/log", visitData);
          console.log("📥 /log fallback response:", fallbackResult);
          
          if (fallbackResult?.success) {
            return {
              success: true,
              visitId: fallbackResult.visitId || fallbackResult.logId,
              message: "Visit saved via fallback"
            };
          }
        } catch (fallbackError) {
          console.error("❌ Fallback also failed:", fallbackError);
        }
      }
      
      throw new Error(`Save failed: ${errorMessage}`);
    }
  },

  async debugAppointment(id) {
    console.log("🔍 Debugging appointment:", id);
    
    const getResult = await request("GET", `/appointments/${id}`);
    console.log("🔍 GET appointment result:", getResult);
    
    try {
      const debugResult = await request("GET", `/api/debug/appointment/${id}`);
      console.log("🔍 Debug endpoint result:", debugResult);
      return debugResult;
    } catch (error) {
      console.log("ℹ️ No debug endpoint available");
    }
    
    return getResult;
  },
  async submitPasswordRecovery(email) {
    return request("POST", "/customer-requests", {
      customerEmail: email,
      serviceType: "password_recovery",
      description: "Password recovery request",
      type: "password_recovery"
    });
  },
  async resetCustomerPassword(requestId, newPassword) {
    return request("POST", "/admin/reset-customer-password", {
      requestId,
      newPassword
    });
  },
  async getRevenueByCustomer(customerId) {
    if (!customerId) return { total_revenue: 0, appointment_count: 0 };

    console.log("💰 Fetching revenue for customer:", customerId);

    const res = await request(
      "GET",
      `/statistics/revenue/customer/${customerId}`
    );

    if (!res || res.success === false) {
      console.warn("⚠️ Customer revenue fetch failed:", res?.error);
      return { total_revenue: 0, appointment_count: 0 };
    }

    return res.data || { total_revenue: 0, appointment_count: 0 };
  },
  async softDeleteCustomer(id) {
    console.log("🗑️ Soft deleting customer:", id);
    console.log("🔍 Making DELETE request to:", `/customers/${id}`);
    const result = await request("DELETE", `/customers/${id}`);
    console.log("📥 Soft delete response:", result);
    return result;
  },

  // RESTORE customer
  async restoreCustomer(id) {
    console.log("🔄 Restoring customer:", id);
    return request("POST", `/customers/${id}/restore`);
  },

  // GET deleted customers
  async getDeletedCustomers() {
    console.log("📋 Getting deleted customers...");
    return request("GET", "/customers/deleted");
  },

  // PERMANENTLY DELETE customer
  async permanentDeleteCustomer(id) {
    console.log("💀 Permanently deleting customer:", id);
    console.log("🔍 Making DELETE request to:", `/customers/${id}/permanent`);
    const result = await request("DELETE", `/customers/${id}/permanent`);
    console.log("📥 Permanent delete response:", result);
    return result;
  },
};

export default {
  API_BASE_URL,
  ...apiService
};