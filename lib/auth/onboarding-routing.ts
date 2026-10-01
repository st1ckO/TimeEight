const appPrefixes = ["/today", "/calendar", "/insights", "/settings"];

function matchesRoute(pathname: string, route: string) {
  return pathname === route || pathname.startsWith(`${route}/`);
}

export function onboardingRedirect(
  pathname: string,
  onboardingCompleted: boolean,
): "/onboarding" | "/today" | null {
  if (pathname === "/login") {
    return onboardingCompleted ? "/today" : "/onboarding";
  }
  if (matchesRoute(pathname, "/onboarding")) {
    return onboardingCompleted ? "/today" : null;
  }
  if (
    !onboardingCompleted &&
    appPrefixes.some((prefix) => matchesRoute(pathname, prefix))
  ) {
    return "/onboarding";
  }
  return null;
}
