import { HeroSection, PrinciplesSection, WorkSection } from "./home-sections";
import { HomeFooter, HomeHeader, PersonStructuredData } from "./home-shell";

export default function HomePage() {
    return (
        <>
            <HomeHeader />
            <main id="main-content">
                <HeroSection />
                <WorkSection />
                <PrinciplesSection />
            </main>
            <HomeFooter />
            <PersonStructuredData />
        </>
    );
}
