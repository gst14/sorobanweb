import { useState } from 'react';
import { LessonScreen } from '@/presentation/screens/lesson/LessonScreen';
import { StartScreen } from '@/presentation/screens/StartScreen';
import { WorldListScreen } from '@/presentation/screens/WorldListScreen';
import '@/presentation/screens/screens.css';

type Route =
  | { readonly name: 'start' }
  | { readonly name: 'worlds' }
  | { readonly name: 'lesson'; readonly lessonId: string };

export function App() {
  const [route, setRoute] = useState<Route>({ name: 'start' });
  const toWorlds = () => {
    setRoute({ name: 'worlds' });
  };

  switch (route.name) {
    case 'start':
      return <StartScreen onStart={toWorlds} />;
    case 'worlds':
      return (
        <WorldListScreen
          onOpenLesson={(lessonId) => {
            setRoute({ name: 'lesson', lessonId });
          }}
        />
      );
    case 'lesson':
      return <LessonScreen lessonId={route.lessonId} onExit={toWorlds} />;
  }
}
