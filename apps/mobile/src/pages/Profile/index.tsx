import { Redirect } from "expo-router"
import { ActivityIndicator, View } from "react-native"
import { useAppTheme } from "@/theme"
import { AccountActionConfirmDialog } from "@/pages/Profile/components/AccountActionConfirmDialog"
import { ProfileContent } from "@/pages/Profile/components/ProfileContent"
import { ProfileEditorModal } from "@/pages/Chat/components/ProfileEditorModal"
import { styles } from "./styles"
import { useProfilePage } from "./useProfilePage"

export default function Profile() {
  const theme = useAppTheme()
  const profile = useProfilePage()

  if (profile.loading) {
    return (
      <View style={[styles.page, { backgroundColor: theme.background }]}>
        <View style={styles.loading}>
          <ActivityIndicator color={theme.primary} />
        </View>
      </View>
    )
  }

  if (!profile.user) return <Redirect href="/login" />

  return (
    <View style={[styles.page, { backgroundColor: theme.background }]}>
      <ProfileContent
        avatar={profile.avatar}
        busy={profile.busy}
        nickname={profile.nickname}
        onEditProfile={profile.openUserProfileEditor}
        onRequestAccountAction={profile.requestAccountAction}
        theme={theme}
      />
      <ProfileEditorModal
        role={profile.profileEditor.activeRole}
        profile={profile.profileEditor.activeProfile}
        error={profile.profileEditor.error}
        onClose={profile.profileEditor.closeProfileEditor}
        onSave={profile.profileEditor.saveProfile}
        theme={theme}
      />
      <AccountActionConfirmDialog
        action={profile.confirmAction}
        loading={profile.busy !== null}
        onCancel={profile.closeConfirmDialog}
        onConfirm={profile.confirmSelectedAction}
        theme={theme}
      />
    </View>
  )
}
