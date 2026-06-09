import * as ImagePicker from "expo-image-picker"

export const AVATAR_MAX_SIZE = 240000

type AvatarPickResult =
  | {
      avatar: string
      error: null
    }
  | {
      avatar: null
      error: string | null
    }

export async function pickAvatarImage(): Promise<AvatarPickResult> {
  const permission = await ImagePicker.requestMediaLibraryPermissionsAsync()
  if (!permission.granted) {
    return {
      avatar: null,
      error: "需要允许访问相册后才能选择头像",
    }
  }

  const result = await ImagePicker.launchImageLibraryAsync({
    allowsEditing: true,
    aspect: [1, 1],
    base64: true,
    mediaTypes: ImagePicker.MediaTypeOptions.Images,
    quality: 0.65,
  })

  if (result.canceled) {
    return {
      avatar: null,
      error: null,
    }
  }

  const asset = result.assets[0]
  if (!asset?.base64) {
    return {
      avatar: null,
      error: "头像读取失败",
    }
  }

  const avatar = `data:${asset.mimeType ?? "image/jpeg"};base64,${asset.base64}`
  if (avatar.length > AVATAR_MAX_SIZE) {
    return {
      avatar: null,
      error: "头像图片太大，请选择更小的图片",
    }
  }

  return {
    avatar,
    error: null,
  }
}
