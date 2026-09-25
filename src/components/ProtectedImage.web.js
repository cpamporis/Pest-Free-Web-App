import React, { useEffect, useRef, useState } from "react";
import { Image } from "react-native";
import apiService from "../services/apiService";

const {
  privateUploadUrl,
  isUploadReference
} = require("../utils/privateUploadUrl");

function useProtectedImageSource(source, onDownloadError) {
  const [token, setToken] = useState(apiService.getCurrentToken());
  const [download, setDownload] = useState(null);
  const errorHandler = useRef(onDownloadError);
  errorHandler.current = onDownloadError;
  const imageUrl =
    source?.uri && isUploadReference(source.uri)
      ? privateUploadUrl(source.uri, apiService.API_BASE_URL)
      : null;
  const protectedReference =
    !!source?.uri && isUploadReference(source.uri);

  useEffect(
    () => apiService.subscribePrivateImageSession(setToken),
    []
  );

  useEffect(() => {
    if (!imageUrl || !token) {
      setDownload(null);
      return undefined;
    }

    let active = true;
    let objectUrl = null;
    const controller = new AbortController();
    setDownload(null);

    fetch(imageUrl, {
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
      redirect: "error",
      signal: controller.signal
    })
      .then(response => {
        if (!response.ok) throw new Error("Image access denied");
        if (!response.headers.get("content-type")?.startsWith("image/")) {
          throw new Error("Unexpected image response");
        }
        return response.blob();
      })
      .then(blob => {
        if (!active) return;
        objectUrl = URL.createObjectURL(blob);
        setDownload({ imageUrl, token, uri: objectUrl });
      })
      .catch(error => {
        if (active) {
          setDownload(null);
          errorHandler.current?.(error);
        }
      });

    return () => {
      active = false;
      controller.abort();
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [imageUrl, token]);

  const displaySource = protectedReference
    ? imageUrl && token &&
      download?.imageUrl === imageUrl &&
      download?.token === token
      ? { uri: download.uri }
      : null
    : source;

  return displaySource;
}

export function ProtectedHtmlImage({ src, onError, ...props }) {
  const source = useProtectedImageSource(
    src ? { uri: src } : null,
    onError
  );

  if (!source?.uri) return null;
  return <img {...props} src={source?.uri} onError={onError} />;
}

export default function ProtectedImage({ source, ...props }) {
  const displaySource = useProtectedImageSource(source);
  return <Image {...props} source={displaySource} />;
}
