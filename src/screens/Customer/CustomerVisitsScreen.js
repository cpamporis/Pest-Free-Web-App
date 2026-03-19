// CustomerVisitsScreen.js - FIXED VERSION with i18n
import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  StyleSheet,
  RefreshControl,
  StatusBar,
  Platform
} from "react-native";
import apiService from "../../services/apiService";
import { SafeAreaView } from "react-native-safe-area-context";
import { MaterialIcons, FontAwesome5, Ionicons, Feather } from '@expo/vector-icons';
import { formatTimeInGreece, formatDateInGreece } from "../../utils/timeZoneUtils";
import i18n from "../../services/i18n";

let Sharing, FileSystem;
if (Platform.OS !== 'web') {
  Sharing = require('expo-sharing');
  FileSystem = require('expo-file-system');
}

export default function CustomerVisitsScreen({ 
  onSelectVisit, 
  onBack
  // REMOVE: navigation from props
}) {

  
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [visits, setVisits] = useState([]);
  const [downloadingId, setDownloadingId] = useState(null);

  const showAlert = (title, message, buttons) => {
    if (Platform.OS === 'web') {
      // For web/desktop, use window.confirm for simple confirmations
      if (buttons && buttons.length > 0) {
        // Check if it's a confirm/cancel dialog (typically 2 buttons)
        if (buttons.length === 2) {
          const confirmAction = window.confirm(`${title}\n\n${message}`);
          if (confirmAction) {
            // User clicked OK/Confirm - execute the second button's onPress (usually the action)
            if (buttons[1]?.onPress) {
              buttons[1].onPress();
            }
          } else {
            // User clicked Cancel - execute the first button's onPress if it exists
            if (buttons[0]?.onPress) {
              buttons[0].onPress();
            }
          }
        } else {
          // Simple alert with just an OK button
          window.alert(`${title}\n\n${message}`);
          if (buttons[0]?.onPress) {
            buttons[0].onPress();
          }
        }
      } else {
        window.alert(`${title}\n\n${message}`);
      }
    } else {
      // For mobile, use React Native Alert
      showAlert(title, message, buttons);
    }
  };

  const loadVisits = async () => {
    try {
      const res = await apiService.getCustomerVisitHistory();
      
      if (res?.success) {
        let visitsData = res.visits || [];
        
        // Process each visit to ensure consistent format
        const processedVisits = visitsData.map(visit => ({
          ...visit,
          // Ensure visitId exists
          visitId: visit.visitId || visit.id || visit.visit_id,
          // Ensure serviceType is set
          serviceType: visit.serviceType || visit.service_type || 'myocide',
          // Format service type for display
          serviceTypeDisplay: visit.serviceTypeDisplay || 
                            formatServiceTypeDisplay(visit.serviceType || visit.service_type, 
                                                      visit.serviceSubtype, 
                                                      visit.otherPestName),
          // Ensure timestamp exists
          startTime: visit.startTime || visit.start_time || visit.createdAt,
        }));
        
        setVisits(processedVisits);
      } else {
        showAlert(i18n.t("common.error"), res?.error || i18n.t("customer.visits.errors.loadFailed"));
        setVisits([]);
      }
    } catch (error) {
      console.error("❌ Load visits error:", error);
      showAlert(i18n.t("common.error"), i18n.t("customer.visits.errors.loadFailed"));
      setVisits([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadVisits();
  }, []);

  const onRefresh = async () => {
    setRefreshing(true);
    await loadVisits();
  };

  const formatTime24WithSuffix = (dateString) => {
    if (!dateString) return "—";
    return formatTimeInGreece(dateString);
  };

  // Download PDF report
  const downloadPDFReport = async (visit) => {
    try {
      setDownloadingId(visit.visitId);
      
      const reportId = visit.visitId;
      
      if (!reportId) {
        showAlert(i18n.t("common.error"), i18n.t("customer.visits.errors.noReportId"));
        return;
      }
      
      const token = apiService.getCurrentToken();
      if (!token) {
        showAlert(i18n.t("common.error"), i18n.t("customer.visits.errors.authRequired"));
        return;
      }
      
      const lang = i18n.getLocale();
      const API_BASE_URL = apiService.API_BASE_URL || "http://192.168.1.79:3000/api";
      const url = `${API_BASE_URL}/reports/pdf/${reportId}?lang=${lang}`;
      
      // Create filename
      const dateStr = visit.startTime ? 
        new Date(visit.startTime).toISOString().split('T')[0] : 
        new Date().toISOString().split('T')[0];
      
      const safeName = (visit.customer_name || visit.customerName || 'customer')
        .replace(/[^a-z0-9]/gi, '_')
        .replace(/^_+|_+$/g, '');
      
      const fileName = `Service_Report_${safeName}_${dateStr}.pdf`;
      
      // Web platform - use anchor tag download with fetch
      if (Platform.OS === 'web') {
        try {
          // Use fetch to get the blob with authentication
          const response = await fetch(url, {
            headers: {
              'Authorization': `Bearer ${token}`,
            },
          });
          
          if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
          }
          
          const blob = await response.blob();
          const blobUrl = window.URL.createObjectURL(blob);
          
          // Create and trigger download
          const link = document.createElement('a');
          link.href = blobUrl;
          link.download = fileName;
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
          
          // Clean up
          window.URL.revokeObjectURL(blobUrl);
          
          showAlert(
            i18n.t("customer.visits.alerts.downloadComplete"),
            i18n.t("customer.visits.alerts.downloadStarted"),
            [{ text: i18n.t("common.ok") || "OK" }]
          );
          
          setDownloadingId(null);
          return;
        } catch (webError) {
          console.error("❌ Web download error:", webError);
          throw webError;
        }
      }
      
      // For mobile - use FileSystem (only reached if not web)
      if (!FileSystem || !Sharing) {
        throw new Error("FileSystem modules not available on this platform");
      }
      
      const getDownloadDirectory = () => {
        if (FileSystem.documentDirectory) {
          return FileSystem.documentDirectory;
        }
        if (FileSystem.cacheDirectory) {
          return FileSystem.cacheDirectory;
        }
        throw new Error("No suitable directory available for download");
      };
      
      const downloadDir = getDownloadDirectory();
      const fileUri = downloadDir + fileName;
      
      const downloadResumable = FileSystem.createDownloadResumable(
        url,
        fileUri,
        {
          headers: {
            'Authorization': `Bearer ${token}`,
          },
        },
        (downloadProgress) => {
          // You can track progress here if needed
          const progress = downloadProgress.totalBytesWritten / downloadProgress.totalBytesExpectedToWrite;
        }
      );

      const { uri } = await downloadResumable.downloadAsync();
      
      const canShare = await Sharing.isAvailableAsync();
      
      if (canShare) {
        await Sharing.shareAsync(uri, {
          mimeType: 'application/pdf',
          dialogTitle: i18n.t("customer.visits.alerts.downloadComplete"),
          UTI: 'com.adobe.pdf'
        });
      } else {
        showAlert(
          i18n.t("customer.visits.alerts.downloadComplete"),
          i18n.t("customer.visits.alerts.downloadCompleteMessage", { path: uri }),
          [{ text: i18n.t("common.ok") || "OK" }]
        );
      }
      
    } catch (error) {
      console.error("❌ PDF download error:", error);
      
      let errorMessage = error.message;
      
      if (error.message.includes('Network request failed')) {
        errorMessage = i18n.t("customer.visits.errors.network");
      } else if (error.message.includes('401') || error.message.includes('403')) {
        errorMessage = i18n.t("customer.visits.errors.auth");
      } else if (error.message.includes('404')) {
        errorMessage = i18n.t("customer.visits.errors.notFound");
      } else if (error.message.includes('Document directory not available')) {
        errorMessage = i18n.t("customer.visits.errors.storage");
      }
      
      showAlert(
        i18n.t("customer.visits.alerts.downloadFailed"),
        errorMessage || i18n.t("customer.visits.errors.downloadFailed")
      );
    } finally {
      setDownloadingId(null);
    }
  };

  const formatServiceTypeDisplay = (serviceType, subtype, otherPestName) => {
    if (!serviceType) return i18n.t("customer.visits.serviceTypes.default") || 'Service';
    
    const type = String(serviceType).toLowerCase();
    
    if (type === 'myocide' || type.includes('myocide')) {
      return i18n.t("customer.visits.serviceTypes.myocide");
    } else if (type === 'disinfection' || type.includes('disinfection')) {
      return i18n.t("customer.visits.serviceTypes.disinfection");
    } else if (type === 'insecticide' || type.includes('insecticide')) {
      return i18n.t("customer.visits.serviceTypes.insecticide");
    } else if (type === 'special' || type.includes('special')) {
      if (subtype === 'other' && otherPestName) {
        return i18n.t("customer.serviceDisplay.special", { name: otherPestName });
      } else if (subtype) {
        // Format subtype (e.g., "grass_cutworm" -> "Grass Cutworm")
        const subtypeLabel = subtype.split('_').map(word => 
          word.charAt(0).toUpperCase() + word.slice(1)
        ).join(' ');
        return i18n.t("customer.serviceDisplay.specialWithSubtype", { subtype: subtypeLabel });
      }
      return i18n.t("customer.visits.serviceTypes.special");
    }
    
    // Default: capitalize
    return serviceType.charAt(0).toUpperCase() + serviceType.slice(1);
  };

  const generateUniqueKey = (item, index) => {
    // Try all possible ID fields
    const possibleIds = [
      item.visitId,
      item.id,
      item.visit_id,
      item.log_id,
      item.appointmentId,
      item.appointment_id
    ];
    
    for (const id of possibleIds) {
      if (id) return `key_${id}`;
    }
    
    // Generate a stable key using data properties
    const timestamp = item.startTime || item.created_at || item.service_start_time;
    if (timestamp) {
      return `key_${timestamp}_${index}`;
    }
    
    // Last resort: index-based with component mount time
    return `key_${index}_${Math.random().toString(36).substr(2, 9)}`;
  };

  const handleViewDetails = (visit) => {

    const visitId = visit.visitId || visit.id || visit.visit_id;

    if (!visitId) {
      console.error("❌ No visitId found in visit object:", visit);
      showAlert(i18n.t("common.error"), i18n.t("customer.visits.errors.noVisitId"));
      return;
    }

    const visitPayload = {
      visitId: visitId,
      serviceType: visit.serviceType || visit.service_type || "myocide",
      customerName: visit.customerName || visit.customer_name || i18n.t("customer.welcome.customer"),
      technicianName: visit.technicianName || visit.technician_name || i18n.t("customer.visits.card.technician"),
      startTime: visit.startTime || visit.start_time || visit.createdAt
    };
    onSelectVisit(visitPayload);
  };

  const renderVisitItem = ({ item }) => {
    const serviceType = item.serviceType || 'myocide';
    const serviceDisplay = item.serviceTypeDisplay || formatServiceTypeDisplay(serviceType);
    const iconName = getServiceIcon(serviceType);
    const color = getServiceColor(serviceType);

    return (
      <TouchableOpacity
        style={styles.visitCard}
        onPress={() => handleViewDetails(item)}
        activeOpacity={0.7}
      >
        <View style={styles.visitHeader}>
          <View style={[styles.serviceTypeBadge, { backgroundColor: color }]}>
            <MaterialIcons name={iconName} size={12} color="#fff" />
            <Text style={styles.serviceTypeText} numberOfLines={1}>
              {serviceDisplay}
            </Text>
          </View>
          <View style={styles.visitStatus}>
            <View style={[styles.statusDot, { backgroundColor: '#4CAF50' }]} />
            <Text style={styles.statusText}>{i18n.t("customer.visits.card.status")}</Text>
          </View>
        </View>

        <View style={styles.visitDetails}>
          <View style={styles.detailRow}>
            <MaterialIcons name="calendar-today" size={16} color="#666" />
            <Text style={styles.detailText}>
              {item.startTime 
                ? formatDateInGreece(item.startTime)
                : i18n.t("customer.visits.card.dateNotAvailable")}
            </Text>
          </View>
          
          <View style={styles.detailRow}>
            <MaterialIcons name="schedule" size={16} color="#666" />
            <Text style={styles.detailText}>
              {item.startTime
                ? formatTimeInGreece(item.startTime)
                : i18n.t("customer.visits.card.timeNotAvailable")}
            </Text>
          </View>
          
          <View style={styles.detailRow}>
            <MaterialIcons name="person" size={16} color="#666" />
            <Text style={styles.detailText}>
              {item.technicianName || i18n.t("customer.visits.card.technician")}
            </Text>
          </View>
          
          <View style={styles.detailRow}>
            <MaterialIcons name="category" size={16} color="#666" />
            <Text style={styles.detailText}>
              {i18n.t("customer.visits.card.service", { type: formatServiceType(item.serviceType || item.workType) })}
            </Text>
          </View>
        </View>

        <View style={styles.cardFooter}>
          <View style={styles.footerActions}>
            <TouchableOpacity
              style={styles.viewButton}
              onPress={() => handleViewDetails(item)}
            >
              <Text style={styles.viewButtonText}>{i18n.t("customer.visits.card.viewReport")}</Text>
              <MaterialIcons name="visibility" size={16} color="#1f9c8b" />
            </TouchableOpacity>
            
            <TouchableOpacity
              style={styles.downloadButton}
              onPress={() => downloadPDFReport(item)}
              disabled={downloadingId === item.visitId}
            >
              {downloadingId === item.visitId ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <>
                  <MaterialIcons name="picture-as-pdf" size={16} color="#fff" />
                  <Text style={styles.downloadButtonText}>{i18n.t("customer.visits.card.downloadPDF")}</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#1f9c8b" />
        <Text style={styles.loadingText}>{i18n.t("customer.visits.loading")}</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#f8f9fa" />
      
      {/* HEADER */}
      <View style={styles.header}>
        <TouchableOpacity 
          style={styles.backButton} 
          onPress={onBack}
          activeOpacity={0.7}
        >
          <MaterialIcons name="arrow-back" size={24} color="#1f9c8b" />
          <Text style={styles.backButtonText}>{i18n.t("customer.visits.back")}</Text>
        </TouchableOpacity>
        
        <View style={styles.headerContent}>
          <Text style={styles.headerTitle}>{i18n.t("customer.visits.title")}</Text>
          <Text style={styles.headerSubtitle}>
            {i18n.t("customer.visits.subtitle")}
          </Text>
        </View>
        
        <View style={styles.headerStats}>
          <Text style={styles.visitsCount}>{visits.length}</Text>
          <Text style={styles.visitsLabel}>{i18n.t("customer.visits.total")}</Text>
        </View>
      </View>

      {/* INFO BANNER */}
      <View style={styles.infoBanner}>
        <MaterialIcons name="info" size={18} color="#1f9c8b" />
        <Text style={styles.infoText}>
          {i18n.t("customer.visits.infoBanner")}
        </Text>
      </View>

      {/* CONTENT */}
      {visits.length === 0 ? (
        <View style={styles.emptyState}>
          <MaterialIcons name="history" size={64} color="#e0e0e0" />
          <Text style={styles.emptyStateTitle}>{i18n.t("customer.visits.empty.title")}</Text>
          <Text style={styles.emptyStateText}>
            {i18n.t("customer.visits.empty.text")}
          </Text>
          <TouchableOpacity 
            style={styles.refreshButton}
            onPress={onRefresh}
            activeOpacity={0.7}
          >
            <MaterialIcons name="refresh" size={18} color="#1f9c8b" />
            <Text style={styles.refreshButtonText}>{i18n.t("customer.visits.empty.refresh")}</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={visits}
          keyExtractor={(item, index) => `${item.visitId}_${item.source || "visit"}_${index}`}
          renderItem={renderVisitItem}
          contentContainerStyle={styles.listContainer}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              colors={["#1f9c8b"]}
              tintColor="#1f9c8b"
            />
          }
          ListHeaderComponent={
            <View style={styles.listHeader}>
              <Text style={styles.listTitle}>{i18n.t("customer.visits.listTitle")}</Text>
              <Text style={styles.listSubtitle}>
                {i18n.t("customer.visits.listSubtitle")}
              </Text>
            </View>
          }
        />
      )}
    </SafeAreaView>
  );
}

// ===== UPDATED HELPER FUNCTIONS =====
const getServiceColor = (serviceType) => {
  // All service types use the same beautiful blue-green color
  return '#1f9c8b';
};

const getServiceIcon = (serviceType) => {
  const type = String(serviceType || '').toLowerCase();
  
  if (type.includes('myocide')) {
    return 'pest-control-rodent';
  } else if (type.includes('disinfection')) {
    return 'clean-hands';
  } else if (type.includes('insecticide')) {
    return 'bug-report';
  } else if (type.includes('special')) {
    return 'star';
  }
  
  return 'description';
};

const formatServiceType = (serviceType) => {
  const type = String(serviceType || '').toLowerCase().trim();
  
  // Map service types to display names
  if (type.includes('myocide') || type.includes('scheduled')) {
    return i18n.t("customer.visits.serviceTypes.myocide");
  } else if (type.includes('disinfection')) {
    return i18n.t("customer.visits.serviceTypes.disinfection");
  } else if (type.includes('insecticide')) {
    return i18n.t("customer.visits.serviceTypes.insecticide");
  } else if (type.includes('special')) {
    return i18n.t("customer.visits.serviceTypes.special");
  } else if (type.includes('inspection')) {
    return i18n.t("customer.visits.serviceTypes.inspection");
  } else if (type.includes('emergency')) {
    return i18n.t("customer.visits.serviceTypes.emergency");
  } else if (type.includes('installation')) {
    return i18n.t("customer.visits.serviceTypes.installation");
  } else if (type.includes('follow-up') || type.includes('followup')) {
    return i18n.t("customer.visits.serviceTypes.followUp");
  } else if (type.includes('regular')) {
    return i18n.t("customer.visits.serviceTypes.regular");
  }
  
  // If we don't recognize it, capitalize it
  return type.charAt(0).toUpperCase() + type.slice(1) + ' ' + i18n.t("customer.visits.serviceTypes.default");
};

// Styles remain the same as previous
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f8f9fa",
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#f8f9fa",
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: "#666",
    fontWeight: '500',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 3,
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 16,
    padding: 8,
  },
  backButtonText: {
    fontSize: 16,
    color: '#1f9c8b',
    fontWeight: '600',
    marginLeft: 4,
  },
  headerContent: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#2c3e50',
    marginBottom: 2,
  },
  headerSubtitle: {
    fontSize: 14,
    color: '#666',
  },
  headerStats: {
    alignItems: 'center',
    paddingLeft: 16,
  },
  visitsCount: {
    fontSize: 24,
    fontWeight: '700',
    color: '#1f9c8b',
  },
  visitsLabel: {
    fontSize: 12,
    color: '#666',
    marginTop: 2,
  },
  infoBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(31, 156, 139, 0.1)',
    paddingHorizontal: 16,
    paddingVertical: 12,
    marginHorizontal: 20,
    marginTop: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(31, 156, 139, 0.2)',
  },
  infoText: {
    fontSize: 13,
    color: '#1f9c8b',
    marginLeft: 8,
    flex: 1,
  },
  listContainer: {
    paddingHorizontal: 20,
    paddingBottom: 40,
  },
  listHeader: {
    paddingVertical: 20,
    paddingHorizontal: 4,
  },
  listTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#2c3e50',
    marginBottom: 4,
  },
  listSubtitle: {
    fontSize: 14,
    color: '#666',
  },
  visitCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    marginBottom: 16,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 3,
    borderWidth: 1,
    borderColor: '#f0f0f0',
  },
  visitHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  serviceTypeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  serviceTypeText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
    marginLeft: 6,
  },
  visitStatus: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 6,
  },
  statusText: {
    fontSize: 12,
    color: '#666',
    fontWeight: '500',
  },
  visitDetails: {
    borderTopWidth: 1,
    borderTopColor: '#f8f9fa',
    borderBottomWidth: 1,
    borderBottomColor: '#f8f9fa',
    paddingVertical: 16,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  detailText: {
    fontSize: 14,
    color: '#2c3e50',
    marginLeft: 12,
    flex: 1,
  },
  cardFooter: {
    paddingTop: 16,
  },
  footerActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  viewButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(31, 156, 139, 0.1)',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
    flex: 1,
    marginRight: 8,
  },
  viewButtonText: {
    fontSize: 14,
    color: '#1f9c8b',
    fontWeight: '600',
    marginRight: 8,
    flex: 1,
  },
  downloadButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1f9c8b',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
    minWidth: 110,
    justifyContent: 'center',
  },
  downloadButtonText: {
    fontSize: 14,
    color: '#fff',
    fontWeight: '600',
    marginLeft: 6,
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  emptyStateTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#666',
    marginTop: 16,
    marginBottom: 8,
  },
  emptyStateText: {
    fontSize: 14,
    color: '#999',
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 24,
  },
  refreshButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(31, 156, 139, 0.1)',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
  },
  refreshButtonText: {
    fontSize: 14,
    color: '#1f9c8b',
    fontWeight: '600',
    marginLeft: 8,
  },
});