// Signup uses the same magic-link flow as login. On first sign-in we detect
// missing OrgMember and route the user through /onboarding to create an org.
export { default } from "../login/page";
