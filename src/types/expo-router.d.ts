import "expo-router"

declare global {
  namespace ExpoRouter {
    type RootParamList = {
      "(tabs)": undefined
      details: { name: string }
      map: undefined
      vessels: undefined
      "vessels-verbose": undefined
      terminals: undefined
      [key: string]: unknown
    }
  }
}
