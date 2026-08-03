import { ShowcaseTopicsPage } from '@/components/showcase/showcase-topics-page';
import { Suspense } from 'react';

export const dynamic = 'force-static';

export default function TopicsPage() {
    return (
        <Suspense fallback={null}>
            <ShowcaseTopicsPage />
        </Suspense>
    );
}
