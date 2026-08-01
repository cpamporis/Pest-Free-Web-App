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
  const [activeDownloadType, setActiveDownloadType] = useState(null);
  const [downloadProgress, setDownloadProgress] = useState(0);

  const isDownloading = activeDownloadType !== null;

  const normalizedServiceType = String(
  visit.serviceType ??
  visit.service_type ??
  visit.serviceCategory ??
  visit.service_category ??
  ""
)
  .trim()
  .toLowerCase();

const isCertificateService =
  normalizedServiceType === "st" ||
  normalizedServiceType.includes("certificate") ||
  normalizedServiceType.includes("certification");

const certificateVisitDate =
  visit.appointmentDate ??
  visit.appointment_date ??
  visit.startTime ??
  visit.start_time ??
  visit.date ??
  visit.createdAt ??
  visit.created_at ??
  null;

const getVisitYear = (value) => {
  if (!value) return null;

  const directYear = String(value).match(/^(\d{4})/);

  if (directYear) {
    return Number(directYear[1]);
  }

  const parsedDate = new Date(value);

  return Number.isNaN(parsedDate.getTime())
    ? null
    : parsedDate.getFullYear();
};

const certificateYear = getVisitYear(certificateVisitDate);
const currentYear = new Date().getFullYear();

const canDownloadCertificate =
  isCertificateService &&
  certificateYear === currentYear;

const locale = String(i18n.getLocale() || "").toLowerCase();
const isGreek = locale.startsWith("el") || locale.startsWith("gr");

const certificateCopy = {
  label: isGreek ? "Πιστοποιητικό" : "Certificate",

  title: isGreek
    ? "Λήψη πιστοποιητικού"
    : "Download Certificate",

  confirmation: isGreek
    ? `Θέλετε να κατεβάσετε το πιστοποιητικό του ${certificateYear};`
    : `Do you want to download the ${certificateYear} certificate?`,

  unavailable: isGreek
    ? "Το πιστοποιητικό είναι διαθέσιμο μόνο για το τρέχον έτος."
    : "The certificate is available only for the current year."
};
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
  
  const handleDownloadPDF = (e, documentType = "report") => {
    e?.stopPropagation?.();

    const isCertificate = documentType === "certificate";

    if (isCertificate && !canDownloadCertificate) {
      showAlert(
        certificateCopy.title,
        certificateCopy.unavailable,
        [{ text: i18n.t("common.ok") || "OK" }]
      );
      return;
    }

    const alertTitle = isCertificate
      ? certificateCopy.title
      : i18n.t("components.swipeableVisitRow.downloadReport");

    const alertMessage = isCertificate
      ? certificateCopy.confirmation
      : i18n.t("components.swipeableVisitRow.downloadConfirm", {
          service:
            visit.serviceType ??
            visit.service_type ??
            i18n.t("components.swipeableVisitRow.service") ??
            "service"
        });

    showAlert(alertTitle, alertMessage, [
      {
        text: i18n.t("components.swipeableVisitRow.cancel"),
        style: "cancel"
      },
      {
        text: i18n.t("components.swipeableVisitRow.download"),
        style: "default",
        onPress: async () => {
          try {
            await downloadPDF(documentType);
          } catch (error) {
            console.error("❌ Download error:", error);
          }
        }
      }
    ]);
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
    if (
      typeLower.includes("certificate") ||
      typeLower.includes("certification") ||
      typeLower === "st"
    ) {
      return i18n.t(
        "components.swipeableVisitRow.serviceTypes.certificate"
      );
    }
    
    return i18n.t("components.swipeableVisitRow.serviceTypes.myocide"); 
  };

  const downloadPDF = async (documentType = "report") => {
    if (isDownloading) return;

    const isCertificate = documentType === "certificate";

    if (isCertificate && !canDownloadCertificate) {
      showAlert(
        certificateCopy.title,
        certificateCopy.unavailable,
        [{ text: i18n.t("common.ok") || "OK" }]
      );
      return;
    }

    setActiveDownloadType(documentType);
    setDownloadProgress(0);

    try {
      const visitId = visit.visitId ?? visit.visit_id;

      if (!visitId) {
        throw new Error("Missing visit ID");
      }

      const token = apiService.getCurrentToken();
      const lang = i18n.getLocale();

      const url = isCertificate
        ? apiService.getCertificatePdfUrl(visitId)
        : `${apiService.API_BASE_URL}/reports/pdf/` +
          `${encodeURIComponent(visitId)}?lang=${encodeURIComponent(lang)}`;

      const generatedSlug = customerName
        ? customerName.replace(/[^a-z0-9]/gi, "_").toLowerCase()
        : "";

      const customerNameSlug = generatedSlug || "customer";

      const reportServiceType =
        visit.serviceType ??
        visit.service_type ??
        "service";

      const shortVisitId = String(visitId).substring(0, 8);

      const filename = isCertificate
        ? `certificate_${customerNameSlug}_${certificateYear}_${shortVisitId}.pdf`
        : `report_${customerNameSlug}_${reportServiceType}_${shortVisitId}.pdf`;

      if (Platform.OS === "web") {
        const response = await fetch(url, {
          headers: token
            ? {
                Authorization: `Bearer ${token}`
              }
            : {}
        });

        const contentType = String(
          response.headers.get("content-type") || ""
        ).toLowerCase();

        if (
          !response.ok ||
          (isCertificate &&
            !contentType.includes("application/pdf"))
        ) {
          const responseText = await response.text();

          let backendMessage =
            `Download failed with status ${response.status}`;

          try {
            const errorData = JSON.parse(responseText);

            backendMessage =
              errorData?.error ??
              errorData?.message ??
              backendMessage;
          } catch {
            if (responseText) {
              backendMessage = responseText;
            }
          }

          throw new Error(backendMessage);
        }

        const blob = await response.blob();

        // Prevent JSON/error responses from being saved as tiny PDFs.
        if (isCertificate) {
          const pdfHeader = await blob.slice(0, 5).text();

          if (pdfHeader !== "%PDF-") {
            let backendMessage =
              "The server did not return a valid certificate PDF";

            try {
              const responseText = await blob.text();
              const errorData = JSON.parse(responseText);

              backendMessage =
                errorData?.error ??
                errorData?.message ??
                backendMessage;
            } catch {
              // Keep the invalid-PDF message.
            }

            throw new Error(backendMessage);
          }
        }

        const blobUrl = window.URL.createObjectURL(blob);
        const link = document.createElement("a");

        link.href = blobUrl;
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);

        window.setTimeout(() => {
          window.URL.revokeObjectURL(blobUrl);
        }, 1000);

        showAlert(
          i18n.t("components.swipeableVisitRow.success") || "Success",
          i18n.t("components.swipeableVisitRow.downloadStarted") ||
            "Download started",
          [{ text: i18n.t("common.ok") || "OK" }]
        );

        return;
      }

      // Existing native fallback remains available.
      if (!FileSystem || !Sharing) {
        throw new Error(
          "FileSystem modules not available on this platform"
        );
      }

      const downloadDirectory =
        FileSystem.documentDirectory ||
        FileSystem.cacheDirectory;

      if (!downloadDirectory) {
        throw new Error("No suitable directory available for download");
      }

      const fileUri = downloadDirectory + filename;

      const downloadResumable =
        FileSystem.createDownloadResumable(
          url,
          fileUri,
          {
            headers: token
              ? {
                  Authorization: `Bearer ${token}`
                }
              : {}
          },
          (progress) => {
            if (progress.totalBytesExpectedToWrite > 0) {
              setDownloadProgress(
                progress.totalBytesWritten /
                  progress.totalBytesExpectedToWrite
              );
            }
          }
        );

      const { uri } = await downloadResumable.downloadAsync();

      const canShare = await Sharing.isAvailableAsync();

      if (canShare) {
        await Sharing.shareAsync(uri, {
          mimeType: "application/pdf",
          dialogTitle: isCertificate
            ? certificateCopy.title
            : i18n.t(
                "components.swipeableVisitRow.downloadReport"
              ),
          UTI: "com.adobe.pdf"
        });
      }
    } catch (error) {
      console.error("❌ PDF download error:", error);

      let errorMessage =
        error?.message || "The PDF could not be downloaded";

      if (errorMessage.includes("Network request failed")) {
        errorMessage = i18n.t(
          "components.swipeableVisitRow.errors.network"
        );
      } else if (
        errorMessage.includes("401") ||
        errorMessage.includes("403")
      ) {
        errorMessage = i18n.t(
          "components.swipeableVisitRow.errors.auth"
        );
      } else if (errorMessage.includes("404")) {
        errorMessage = i18n.t(
          "components.swipeableVisitRow.errors.notFound"
        );
      }

      showAlert(
        isCertificate
          ? certificateCopy.title
          : i18n.t(
              "components.swipeableVisitRow.downloadFailed"
            ),
        errorMessage,
        [{ text: i18n.t("common.ok") || "OK" }]
      );
    } finally {
      setActiveDownloadType(null);
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
        
        {/* REPORT AND CERTIFICATE DOWNLOAD BUTTONS */}
<View style={styles.downloadButtons}>
  <TouchableOpacity
    style={[
      styles.pdfButton,
      activeDownloadType === "report" &&
        styles.downloadingButton
    ]}
    onPress={(event) =>
      handleDownloadPDF(event, "report")
    }
    activeOpacity={0.7}
    disabled={isDownloading}
  >
    {activeDownloadType === "report" ? (
      <View style={styles.pdfButtonContent}>
        <ActivityIndicator size="small" color="#fff" />

        <Text style={styles.pdfButtonText}>
          {Platform.OS === "web"
            ? "..."
            : `${Math.round(downloadProgress * 100)}%`}
        </Text>
      </View>
    ) : (
      <View style={styles.pdfButtonContent}>
        <MaterialIcons
          name="picture-as-pdf"
          size={22}
          color="#fff"
        />

        <Text style={styles.pdfButtonText}>
          {i18n.t(
            "components.swipeableVisitRow.download"
          )}
        </Text>
      </View>
    )}
  </TouchableOpacity>

  {canDownloadCertificate && (
    <TouchableOpacity
      style={[
        styles.certificateButton,
        activeDownloadType === "certificate" &&
          styles.downloadingButton
      ]}
      onPress={(event) =>
        handleDownloadPDF(event, "certificate")
      }
      activeOpacity={0.7}
      disabled={isDownloading}
    >
      {activeDownloadType === "certificate" ? (
        <ActivityIndicator size="small" color="#fff" />
      ) : (
        <View style={styles.pdfButtonContent}>
          <MaterialIcons
            name="verified"
            size={22}
            color="#fff"
          />

          <Text style={styles.certificateButtonText}>
            {certificateCopy.label}
          </Text>
        </View>
      )}
    </TouchableOpacity>
  )}
</View>
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

  downloadButtons: {
  flexDirection: "row",
  alignItems: "center",
  marginLeft: 8
},

downloadingButton: {
  backgroundColor: "#666"
},

certificateButton: {
  width: 100,
  height: 60,
  borderRadius: 30,
  marginLeft: 8,
  paddingHorizontal: 8,
  backgroundColor: "#176f64",
  justifyContent: "center",
  alignItems: "center",
  shadowColor: "#000",
  shadowOffset: {
    width: 0,
    height: 2
  },
  shadowOpacity: 0.1,
  shadowRadius: 4,
  elevation: 3
},

certificateButtonText: {
  color: "#fff",
  fontSize: 9,
  fontWeight: "600",
  marginTop: 2,
  textAlign: "center",
  fontFamily: "System"
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