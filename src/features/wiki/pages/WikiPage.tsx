/**
 * WikiPage
 * Main entry point for the Wiki feature with nested routes.
 * Phase 2A: Added routes for Worldbuilding, Story Beats, Timelines, Relationships, Media.
 * Phase 2C: Now using full implementations for Timelines, Relationships, and Media.
 */
import React from 'react';
import { Routes, Route } from 'react-router-dom';
import { WikiLayout } from '../components/WikiLayout';
import { WikiHome } from '../components/WikiHome';
import { WikiCollections } from '../components/WikiCollections';
import { WikiEntityPage } from '../components/WikiEntityPage';
import { WikiWorldbuilding } from '../components/WikiWorldbuilding';
import { WikiStoryBeats } from '../components/WikiStoryBeats';
import { WikiTimelines } from '../components/WikiTimelines';
import { WikiRelationships } from '../components/WikiRelationships';
import { WikiMedia } from '../components/WikiMedia';

export function WikiPage() {
    return (
        <Routes>
            <Route element={<WikiLayout />}>
                {/* Main views */}
                <Route index element={<WikiHome />} />
                <Route path="collections/:categoryId" element={<WikiCollections />} />
                <Route path="entity/:entityId" element={<WikiEntityPage />} />

                {/* Special sections */}
                <Route path="worldbuilding" element={<WikiWorldbuilding />} />
                <Route path="beats" element={<WikiStoryBeats />} />
                <Route path="timelines" element={<WikiTimelines />} />
                <Route path="relationships" element={<WikiRelationships />} />
                <Route path="media" element={<WikiMedia />} />
            </Route>
        </Routes>
    );
}

export default WikiPage;
