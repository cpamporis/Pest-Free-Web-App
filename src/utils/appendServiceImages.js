import { Platform } from "react-native";

const WEB_IMAGE_EXTENSIONS = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/gif": "gif",
  "image/webp": "webp",
  "image/heic": "heic",
  "image/heif": "heif"
};

function imageName(asset, index, mimeType) {
  const suppliedName = asset?.fileName || asset?.name;

  if (suppliedName) {
    return suppliedName;
  }

  const extension = WEB_IMAGE_EXTENSIONS[mimeType] || "jpg";
  return `photo_${Date.now()}_${index}.${extension}`;
}

async function webImageBlob(asset) {
  if (!asset?.uri) {
    throw new Error("Selected image is missing its data");
  }

  const response = await fetch(asset.uri);

  if (!response.ok) {
    throw new Error("Selected image could not be read");
  }

  const blob = await response.blob();
  const mimeType = blob.type || asset.type || "";

  if (!blob.size) {
    throw new Error("Selected image is empty");
  }

  if (!WEB_IMAGE_EXTENSIONS[mimeType]) {
    throw new Error("Selected image format is not supported");
  }

  return { blob, mimeType };
}

export async function appendServiceImages(
  formData,
  images,
  { fieldName = "images", maxImages } = {}
) {
  if (!Array.isArray(images) || images.length === 0) {
    return 0;
  }

  const selectedImages = Number.isInteger(maxImages)
    ? images.slice(0, maxImages)
    : images;
  let appended = 0;

  for (let index = 0; index < selectedImages.length; index += 1) {
    const asset = selectedImages[index];
    if (!asset?.uri) continue;

    if (Platform.OS === "web") {
      const { blob, mimeType } = await webImageBlob(asset);
      formData.append(
        fieldName,
        blob,
        imageName(asset, index, mimeType)
      );
    } else {
      const type = asset.type || "image/jpeg";
      const uri = Platform.OS === "ios"
        ? asset.uri.replace("file://", "")
        : asset.uri;

      formData.append(fieldName, {
        uri,
        name: imageName(asset, index, type),
        type
      });
    }

    appended += 1;
  }

  return appended;
}
