import * as ImagePicker from "expo-image-picker"
import { useEffect, useState } from "react"
import { useProfileStore } from "@/stores/profileStore"

type ProfileRole = "user" | "agent"

const maxAvatarSize = 240000

export function useAvatarActions({
  role,
  onError,
}: {
  role: ProfileRole
  onError: (error: string | null) => void
}) {
  const profiles = useProfileStore((state) => state.profiles)
  const profilesReady = useProfileStore((state) => state.ready)
  const [avatar, setAvatar] = useState(profiles[role].avatar_url ?? "")

  useEffect(() => {
    if (!profilesReady) return
    setAvatar(profiles[role].avatar_url ?? "")
  }, [profiles, profilesReady, role])

  async function pickAvatar() {
    onError(null)
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync()
    if (!permission.granted) {
      onError("需要允许访问相册后才能选择头像")
      return
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      allowsEditing: true,
      aspect: [1, 1],
      base64: true,
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.65,
    })

    if (result.canceled) return
    const asset = result.assets[0]
    if (!asset?.base64) {
      onError("头像读取失败")
      return
    }

    const nextAvatar = `data:${asset.mimeType ?? "image/jpeg"};base64,${asset.base64}`
    if (nextAvatar.length > maxAvatarSize) {
      onError("头像图片太大，请选择更小的图片")
      return
    }

    setAvatar(nextAvatar)
  }

  return {
    avatar,
    pickAvatar,
  }
}
