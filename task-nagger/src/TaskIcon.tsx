import React from 'react';
import { Image, View } from 'react-native';
import { Illustration, pickIcon } from './illustrations';
import { Task } from './types';

export function TaskIcon({ task, size = 56 }: { task: Pick<Task, 'title' | 'icon' | 'color' | 'imageUri'>; size?: number }) {
  const kind = task.icon === 'auto' ? pickIcon(task.title) : task.icon;
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size * 0.32,
        backgroundColor: task.color + '22',
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'hidden',
      }}
    >
      {task.imageUri ? (
        <Image source={{ uri: task.imageUri }} style={{ width: size, height: size }} />
      ) : (
        <Illustration kind={kind} color={task.color} size={size * 0.74} />
      )}
    </View>
  );
}
