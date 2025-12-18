import React from 'react';
import { TrendingUp, AlertCircle, Sparkles } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { cn } from '@/lib/utils';
import type { SentenceLengthDistribution, FlowInsights } from '@/lib/analytics/textAnalytics';

interface FlowScoreSectionProps {
    score: number;
    distribution: SentenceLengthDistribution;
    insights: FlowInsights;
}

const CATEGORIES = [
    {
        key: '1' as keyof SentenceLengthDistribution,
        label: '1 word',
        color: 'from-violet-400 to-violet-500',
        textColor: 'text-violet-700 dark:text-violet-300',
        bgColor: 'bg-violet-100 dark:bg-violet-950/50',
        borderColor: 'border-violet-300 dark:border-violet-700'
    },
    {
        key: '2-6',
        label: '2–6 words',
        color: 'from-blue-400 to-blue-500',
        textColor: 'text-blue-700 dark:text-blue-300',
        bgColor: 'bg-blue-100 dark:bg-blue-950/50',
        borderColor: 'border-blue-300 dark:border-blue-700'
    },
    {
        key: '7-15',
        label: '7–15 words',
        color: 'from-emerald-400 to-emerald-500',
        textColor: 'text-emerald-700 dark:text-emerald-300',
        bgColor: 'bg-emerald-100 dark:bg-emerald-950/50',
        borderColor: 'border-emerald-300 dark:border-emerald-700'
    },
    {
        key: '16-25',
        label: '16–25 words',
        color: 'from-amber-400 to-amber-500',
        textColor: 'text-amber-700 dark:text-amber-300',
        bgColor: 'bg-amber-100 dark:bg-amber-950/50',
        borderColor: 'border-amber-300 dark:border-amber-700'
    },
    {
        key: '26-39',
        label: '26–39 words',
        color: 'from-orange-400 to-orange-500',
        textColor: 'text-orange-700 dark:text-orange-300',
        bgColor: 'bg-orange-100 dark:bg-orange-950/50',
        borderColor: 'border-orange-300 dark:border-orange-700'
    },
    {
        key: '40+',
        label: '40+ words',
        color: 'from-rose-400 to-rose-500',
        textColor: 'text-rose-700 dark:text-rose-300',
        bgColor: 'bg-rose-100 dark:bg-rose-950/50',
        borderColor: 'border-rose-300 dark:border-rose-700'
    },
];

export function FlowScoreSection({ score, distribution, insights }: FlowScoreSectionProps) {
    const getScoreGrade = (score: number) => {
        if (score >= 85) return { label: 'Excellent', color: 'text-emerald-600 dark:text-emerald-400' };
        if (score >= 70) return { label: 'Good', color: 'text-blue-600 dark:text-blue-400' };
        if (score >= 50) return { label: 'Fair', color: 'text-amber-600 dark:text-amber-400' };
        return { label: 'Needs Work', color: 'text-rose-600 dark:text-rose-400' };
    };

    const grade = getScoreGrade(score);
    const totalSentences = Object.values(distribution).reduce((a, b) => a + b, 0);

    return (
        <div className="space-y-4">
            {/* Header with Score */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <TrendingUp className="h-4 w-4 text-primary" />
                    <span className="text-sm font-medium">Flow Score</span>
                </div>
                <div className="flex items-center gap-2">
                    <Badge variant="outline" className={cn("font-bold text-lg px-3", grade.color)}>
                        {score}%
                    </Badge>
                    <span className={cn("text-xs font-medium", grade.color)}>
                        {grade.label}
                    </span>
                </div>
            </div>

            {/* Animated Progress Bar */}
            <div className="relative">
                <Progress
                    value={score}
                    className="h-3 bg-muted/50"
                />
                <div
                    className={cn(
                        "absolute top-0 left-0 h-3 rounded-full transition-all duration-700 ease-out bg-gradient-to-r",
                        score >= 70 ? "from-emerald-500 to-blue-500" :
                            score >= 50 ? "from-amber-500 to-orange-500" :
                                "from-rose-500 to-red-500"
                    )}
                    style={{ width: `${score}%` }}
                />
            </div>

            {/* Sentence Distribution Grid */}
            <div className="space-y-2">
                <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                    Sentence Variation
                </span>
                <div className="grid grid-cols-3 gap-2">
                    {CATEGORIES.map((cat) => {
                        const count = distribution[cat.key];
                        const percentage = totalSentences > 0
                            ? Math.round((count / totalSentences) * 100)
                            : 0;
                        const isDominant = cat.key === insights.dominantRange;

                        return (
                            <div
                                key={cat.key}
                                className={cn(
                                    "relative rounded-lg p-3 border transition-all duration-300",
                                    cat.bgColor,
                                    cat.borderColor,
                                    isDominant && "ring-2 ring-offset-2 ring-primary",
                                    "hover:scale-105 hover:shadow-md"
                                )}
                            >
                                {/* Sparkle badge for dominant */}
                                {isDominant && (
                                    <Sparkles className="absolute -top-1.5 -right-1.5 h-4 w-4 text-primary fill-primary" />
                                )}

                                <div className="flex flex-col gap-1">
                                    <span className={cn("text-xs font-medium", cat.textColor)}>
                                        {cat.label}
                                    </span>
                                    <div className="flex items-baseline gap-1.5">
                                        <span className={cn("text-2xl font-bold", cat.textColor)}>
                                            {count}
                                        </span>
                                        <span className="text-xs text-muted-foreground">
                                            {percentage}%
                                        </span>
                                    </div>
                                </div>

                                {/* Mini bar indicator */}
                                <div className="mt-2 h-1 bg-white/30 dark:bg-black/20 rounded-full overflow-hidden">
                                    <div
                                        className={cn("h-full bg-gradient-to-r transition-all duration-500", cat.color)}
                                        style={{ width: `${percentage}%` }}
                                    />
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* Insights & Recommendations */}
            <div className="space-y-2">
                {insights.hasMonotony && (
                    <div className="flex items-start gap-2 p-3 rounded-lg bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800">
                        <AlertCircle className="h-4 w-4 text-amber-600 dark:text-amber-400 mt-0.5 shrink-0" />
                        <div className="text-xs">
                            <p className="font-medium text-amber-900 dark:text-amber-100">
                                Monotony detected
                            </p>
                            <p className="text-amber-700 dark:text-amber-300 mt-0.5">
                                You have 5+ consecutive sentences of similar length. Try breaking them up for variety.
                            </p>
                        </div>
                    </div>
                )}

                {insights.consecutivePatterns > 0 && !insights.hasMonotony && (
                    <p className="text-xs text-muted-foreground italic">
                        Found {insights.consecutivePatterns} pattern{insights.consecutivePatterns > 1 ? 's' : ''} of consecutive similar sentences. Consider mixing lengths for better rhythm.
                    </p>
                )}

                {score >= 85 && (
                    <p className="text-xs text-emerald-600 dark:text-emerald-400 italic font-medium">
                        ✨ Excellent sentence variety! Your writing has great rhythm and flow.
                    </p>
                )}

                {score < 50 && !insights.hasMonotony && (
                    <p className="text-xs text-muted-foreground italic">
                        Mix short, medium, and long sentences to improve flow and engage readers.
                    </p>
                )}
            </div>

            {/* Variety Score Badge */}
            <div className="flex items-center justify-between pt-2 border-t">
                <span className="text-xs text-muted-foreground">Distribution Balance</span>
                <Badge variant="secondary" className="font-mono">
                    {insights.varietyScore}% varied
                </Badge>
            </div>
        </div>
    );
}
