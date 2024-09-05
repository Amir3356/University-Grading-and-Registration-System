import { createContext, useContext } from 'react'

export const ThemeContext = createContext({ theme: 'light', setTheme: () => {}, toggle: () => {} })
export const useTheme = () => useContext(ThemeContext)
