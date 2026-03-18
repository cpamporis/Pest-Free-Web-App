// components/SwipeableVisitRow.js - COMPLETE FIX
import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Alert,
  Platform,
  ActivityIndicator
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import apiService from '../services/apiService';
import i18n from "../services/i18n";

// Conditionally import native modules only for non-web platforms
let FileSystem, Sharing;
if (Platform.OS !== 'web') {
  FileSystem = require('expo-file-system');
  Sharing = require('expo-sharing');
}

export default function SwipeableVisitRow({ 
  visit, 
  onPress,
  customerName,
  isNested = false,
  appointmentId
}) {
  const [isDownloading, setIsDownloading] = useState(false);
  const [downloadProgress, setDownloadProgress] = useState(0);
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
  
  const handleDownloadPDF = async (e) => {
    // Stop event propagation to prevent triggering the parent onPress
    e?.stopPropagation();
    
    showAlert(
      i18n.t("components.swipeableVisitRow.downloadReport"),
      i18n.t("components.swipeableVisitRow.downloadConfirm", { 
        service: visit.serviceType || i18n.t("components.swipeableVisitRow.service") || 'service' 
      }),
      [
        { 
          text: i18n.t("components.swipeableVisitRow.cancel"), 
          style: "cancel"
        },
        { 
          text: i18n.t("components.swipeableVisitRow.download"), 
          style: "default",
          onPress: async () => {
            try {
              await downloadPDF();
            } catch (error) {
              console.error("❌ Download error:", error);
            }
          }
        }
      ]
    );
  };

  const getTranslatedServiceType = (type) => {
    const typeLower = type?.toLowerCase() || '';
    
    if (typeLower.includes('myocide')) {
      return i18n.t("components.swipeableVisitRow.serviceTypes.myocide");
    }
    if (typeLower.includes('insecticide')) {
      return i18n.t("components.swipeableVisitRow.serviceTypes.insecticide");
    }
    if (typeLower.includes('disinfection')) {
      return i18n.t("components.swipeableVisitRow.serviceTypes.disinfection");
    }
    if (typeLower.includes('special')) {
      return i18n.t("components.swipeableVisitRow.serviceTypes.special");
    }
    
    return i18n.t("components.swipeableVisitRow.serviceTypes.myocide"); 
  };

  const downloadPDF = async () => {
    // Double-check we're not already downloading
    if (isDownloading) {
      return;
    }
    
    setIsDownloading(true);
    setDownloadProgress(0);

    try {
      const token = apiService.getCurrentToken();
      const lang = i18n.getLocale();
      const url = `${apiService.API_BASE_URL}/reports/pdf/${visit.visitId}?lang=${lang}`;
      
      // Web platform - use anchor tag download
      if (Platform.OS === 'web') {
        try {
          // Create a hidden anchor element
          const link = document.createElement('a');
          
          // For authenticated requests, we need to include the token
          // Option 1: Add token as query parameter (if your backend supports it)
          const urlWithToken = `${url}&token=${token}`;
          link.href = urlWithToken;
          
          // Option 2: Use fetch to get the blob and create object URL
          // This is more reliable for authenticated downloads
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
          
          link.href = blobUrl;
          link.download = `report_${visit.visitId}.pdf`; // Set filename
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
          
          // Clean up the blob URL
          window.URL.revokeObjectURL(blobUrl);
          
          showAlert(
            i18n.t("components.swipeableVisitRow.success") || "Success",
            i18n.t("components.swipeableVisitRow.downloadStarted") || "Download started",
            [{ text: i18n.t("common.ok") || "OK" }]
          );
          
          setIsDownloading(false);
          return;
        } catch (webError) {
          console.error("❌ Web download error:", webError);
          showAlert(
            i18n.t("components.swipeableVisitRow.downloadFailed") || "Download Failed",
            webError.message,
            [{ text: i18n.t("common.ok") || "OK" }]
          );
          setIsDownloading(false);
          return;
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
      
      const customerNameSlug = customerName 
        ? customerName.replace(/[^a-z0-9]/gi, '_').toLowerCase()
        : 'customer';
      const serviceType = visit.serviceType || 'service';
      const filename = `report_${customerNameSlug}_${serviceType}_${visit.visitId?.substring(0, 8) || Date.now()}.pdf`;
      
      const downloadDir = getDownloadDirectory();
      const fileUri = downloadDir + filename;
      
      const downloadResumable = FileSystem.createDownloadResumable(
        url,
        fileUri,
        {
          headers: {
            'Authorization': `Bearer ${token}`,
          },
        },
        (downloadProgress) => {
          const progress = downloadProgress.totalBytesWritten / downloadProgress.totalBytesExpectedToWrite;
          setDownloadProgress(progress);
        }
      );

      const { uri } = await downloadResumable.downloadAsync();
      
      const canShare = await Sharing.isAvailableAsync();
      
      if (canShare) {
        await Sharing.shareAsync(uri, {
          mimeType: 'application/pdf',
          dialogTitle: i18n.t("components.swipeableVisitRow.downloadReport"),
          UTI: 'com.adobe.pdf'
        });
      } else {
        showAlert(
          i18n.t("components.swipeableVisitRow.success") || "Success", 
          i18n.t("components.swipeableVisitRow.pdfSaved", { path: uri }),
          [{ text: i18n.t("common.ok") || "OK" }]
        );
      }
      
    } catch (error) {
      console.error("❌ PDF download error:", error);
      
      let errorMessage = error.message;
      
      if (error.message.includes('Network request failed')) {
        errorMessage = i18n.t("components.swipeableVisitRow.errors.network");
      } else if (error.message.includes('401') || error.message.includes('403')) {
        errorMessage = i18n.t("components.swipeableVisitRow.errors.auth");
      } else if (error.message.includes('404')) {
        errorMessage = i18n.t("components.swipeableVisitRow.errors.notFound");
      } else if (error.message.includes('Document directory not available')) {
        errorMessage = i18n.t("components.swipeableVisitRow.errors.storage");
      }
      
      showAlert(
        i18n.t("components.swipeableVisitRow.downloadFailed") || "Download Failed", 
        errorMessage,
        [{ text: i18n.t("common.ok") || "OK" }]
      );
    } finally {
      setIsDownloading(false);
      setDownloadProgress(0);
    }
  };

  return (
    <TouchableOpacity
      style={[
        styles.customerCard,
        isNested && styles.visitRowNested
      ]}
      activeOpacity={0.7}
      onPress={onPress}
    >
      <View style={styles.customerHeader}>
        <View style={styles.customerAvatar}>
          <MaterialIcons name="assignment" size={22} color="#fff" />
        </View>
        
        <View style={styles.customerInfo}>
          <Text style={styles.customerName}>
            {visit.serviceType
              ? getTranslatedServiceType(visit.serviceType)
              : i18n.t("components.swipeableVisitRow.service") || "Service"}
          </Text>
          
          <View style={styles.customerMeta}>
            <View style={styles.customerMetaItem}>
              <MaterialIcons name="calendar-today" size={12} color="#666" />
              <Text style={styles.customerMetaText}>
                {visit.appointmentDate
                  ? new Date(visit.appointmentDate).toLocaleDateString()
                  : i18n.t("components.swipeableVisitRow.unknownDate")}
              </Text>
            </View>
            
            {visit.duration && (
              <View style={styles.customerMetaItem}>
                <MaterialIcons name="timer" size={12} color="#666" />
                <Text style={styles.customerMetaText}>
                  {Math.floor(visit.duration / 60)} {i18n.t("components.swipeableVisitRow.minutes")}
                </Text>
              </View>
            )}
            
            {visit.technicianName && (
              <View style={styles.customerMetaItem}>
                <MaterialIcons name="person" size={12} color="#666" />
                <Text style={styles.customerMetaText}>
                  {visit.technicianName}
                </Text>
              </View>
            )}
          </View>
          
          {/* APPOINTMENT ID SECTION */}
          {(appointmentId || visit.appointmentId) && (
            <View style={styles.appointmentIdContainer}>
              <MaterialIcons name="fingerprint" size={10} color="#888" />
              <Text style={styles.appointmentIdText}>
                {i18n.t("components.swipeableVisitRow.appointmentId", { 
                  id: appointmentId || visit.appointmentId 
                })}
              </Text>
            </View>
          )}
        </View>
        
        {/* PDF DOWNLOAD BUTTON */}
        <TouchableOpacity
          style={styles.pdfButton}
          onPress={handleDownloadPDF}
          activeOpacity={0.7}
          disabled={isDownloading}
        >
          {isDownloading ? (
            <View style={styles.pdfButtonContent}>
              <ActivityIndicator size="small" color="#fff" />
              <Text style={styles.pdfButtonText}>
                {Platform.OS === 'web' ? '...' : `${Math.round(downloadProgress * 100)}%`}
              </Text>
            </View>
          ) : (
            <View style={styles.pdfButtonContent}>
              <MaterialIcons name="picture-as-pdf" size={22} color="#fff" />
              <Text style={styles.pdfButtonText}>{i18n.t("components.swipeableVisitRow.download")}</Text>
            </View>
          )}
        </TouchableOpacity>
      </View>
    </TouchableOpacity>
  );
}
const styles = StyleSheet.create({
  customerCard: {
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 16,
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 3,
    borderWidth: 1,
    borderColor: "#f0f0f0",
    marginBottom: 8,
  },
  visitRowNested: {
    backgroundColor: "#fafafa",
  },
  customerHeader: {
    flexDirection: "row",
    alignItems: "center",
  },
  customerAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: "#1f9c8b",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
  },
  customerInfo: {
    flex: 1,
    marginRight: 12,
  },
  customerName: {
    fontSize: 16,
    fontWeight: "600",
    color: "#2c3e50",
    marginBottom: 6,
    fontFamily: 'System',
  },
  customerMeta: {
    flexDirection: "row",
    flexWrap: "wrap",
  },
  customerMetaItem: {
    flexDirection: "row",
    alignItems: "center",
    marginRight: 12,
    marginBottom: 4,
  },
  customerMetaText: {
    fontSize: 11,
    color: "#666",
    marginLeft: 4,
    fontFamily: 'System',
  },
  // APPOINTMENT ID STYLES
  appointmentIdContainer: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 4,
  },
  appointmentIdText: {
    fontSize: 10,
    color: "#888",
    marginLeft: 4,
    fontFamily: 'System',
    fontStyle: 'italic',
  },
  // PDF BUTTON STYLES
  pdfButton: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: "#1f9c8b",
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  pdfButtonContent: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  pdfButtonText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '600',
    marginTop: 2,
    fontFamily: 'System',
  },
});