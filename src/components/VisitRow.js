//components/VisitRow.js
import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Alert
} from "react-native";
import { MaterialIcons } from "@expo/vector-icons";
import apiService from "../services/apiService";

export default function VisitRow({
  visit,
  appointmentId,
  customerName,
  onPress,
  isNested = false
}) {
  const [isDownloading, setIsDownloading] = useState(false);

  const handleDownloadPDF = async () => {
    Alert.alert(
      "Download Report",
      `Download PDF report for ${visit.serviceType || "service"}?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Download",
          onPress: async () => {
            try {
              setIsDownloading(true);
              await apiService.downloadVisitReportPdf({
                visitId: visit.visitId,
                appointmentId,
                customerName,
                serviceType: visit.serviceType,
              });
            } catch (err) {
              console.error("❌ PDF download failed:", err);
            } finally {
              setIsDownloading(false);
            }
          }
        }
      ]
    );
  };

  return (
    <TouchableOpacity
      style={[styles.row, isNested && styles.rowNested]}
      activeOpacity={0.7}
      onPress={onPress}
    >
      {/* LEFT CONTENT */}
      <View style={styles.info}>
        <Text style={styles.serviceType}>
          {visit.serviceType
            ? visit.serviceType.charAt(0).toUpperCase() + visit.serviceType.slice(1)
            : "Service"}
        </Text>

        {/* META ROW */}
        <View style={styles.metaRow}>
          <View style={styles.metaItem}>
            <MaterialIcons name="calendar-today" size={12} color="#666" />
            <Text style={styles.metaText}>
              {visit.appointmentDate
                ? new Date(visit.appointmentDate).toLocaleDateString()
                : "Unknown date"}
            </Text>
          </View>

          {visit.duration ? (
            <View style={styles.metaItem}>
              <MaterialIcons name="timer" size={12} color="#666" />
              <Text style={styles.metaText}>
                {Math.floor(visit.duration / 60)} min
              </Text>
            </View>
          ) : null}

          {visit.technicianName ? (
            <View style={styles.metaItem}>
              <MaterialIcons name="person" size={12} color="#666" />
              <Text style={styles.metaText}>
                {visit.technicianName}
              </Text>
            </View>
          ) : null}
        </View>

        {/* APPOINTMENT ID */}
        {(appointmentId || visit.appointmentId) && (
          <View style={styles.appointmentIdContainer}>
            <MaterialIcons name="fingerprint" size={10} color="#888" />
            <Text style={styles.appointmentIdText}>
              Appointment ID: {appointmentId || visit.appointmentId}
            </Text>
          </View>
        )}
      </View>

      {/* PDF BUTTON */}
      <TouchableOpacity
        style={styles.pdfButton}
        onPress={handleDownloadPDF}
        activeOpacity={0.7}
        disabled={isDownloading}
      >
        {isDownloading ? (
          <ActivityIndicator size="small" color="#fff" />
        ) : (
          <MaterialIcons name="picture-as-pdf" size={22} color="#fff" />
        )}
      </TouchableOpacity>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 20,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#f0f0f0",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 3,
  },
  rowNested: {
    backgroundColor: "#fafafa",
  },
  info: {
    flex: 1,
    marginRight: 12,
  },
  serviceType: {
    fontSize: 18,
    fontWeight: "600",
    color: "#2c3e50",
    marginBottom: 8,
  },
  metaRow: {
    flexDirection: "row",
    flexWrap: "wrap",
  },
  metaItem: {
    flexDirection: "row",
    alignItems: "center",
    marginRight: 16,
    marginBottom: 4,
  },
  metaText: {
    fontSize: 12,
    color: "#666",
    marginLeft: 4,
  },
  appointmentIdContainer: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 4,
  },
  appointmentIdText: {
    fontSize: 11,
    color: "#888",
    marginLeft: 4,
    fontStyle: "italic",
  },
  pdfButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "#1f9c8b",
    justifyContent: "center",
    alignItems: "center",
  },
});