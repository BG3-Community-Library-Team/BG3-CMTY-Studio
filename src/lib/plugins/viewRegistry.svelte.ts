/**
 * EXT-4: View Registry — sidebar panel and view container contributions.
 *
 * Plugins declare views (sidebar panels) and view containers (sidebar sections).
 * The manifest declares them declaratively; activate() binds runtime components.
 */

import type { Component } from "svelte";
import type { ViewContribution, ViewContainerContribution, Disposable } from "./pluginTypes.js";
import { contextKeys } from "./contextKeyService.svelte.js";

interface RegisteredView {
  id: string;
  name: string;
  pluginId: string;
  containerId: string;
  when?: string;
  icon?: string;
  component: Component | null;
}

interface RegisteredViewContainer {
  id: string;
  title: string;
  icon: string;
  pluginId: string;
  location: "sidebar" | "panel";
}

class ViewRegistry {
  private containers: RegisteredViewContainer[] = $state([]);
  private views: RegisteredView[] = $state([]);
  private viewContexts = new Map<string, Record<string, unknown>>();

  /** Register a view container from a plugin manifest */
  registerViewContainer(pluginId: string, container: ViewContainerContribution): Disposable {
    const entry: RegisteredViewContainer = {
      id: container.id,
      title: container.title,
      icon: container.icon,
      pluginId,
      location: container.location,
    };
    this.containers = [...this.containers, entry];
    return {
      dispose: () => {
        this.containers = this.containers.filter(c => c !== entry);
      },
    };
  }

  /** Register a view from a plugin manifest */
  registerView(pluginId: string, containerId: string, view: ViewContribution): Disposable {
    const entry: RegisteredView = {
      id: view.id,
      name: view.name,
      pluginId,
      containerId,
      when: view.when,
      icon: view.icon,
      component: null,
    };
    this.views = [...this.views, entry];
    return {
      dispose: () => {
        this.views = this.views.filter(v => v !== entry);
      },
    };
  }

  /** Set the runtime component for a view (called during plugin activate()) */
  setViewComponent(viewId: string, component: Component, context?: Record<string, unknown>): void {
    this.views = this.views.map(v =>
      v.id === viewId ? { ...v, component } : v
    );
    if (context) {
      this.viewContexts.set(viewId, context);
    }
  }

  /** Get the runtime component for a view */
  getViewComponent(viewId: string): Component | undefined {
    const view = this.views.find(v => v.id === viewId);
    return view?.component ?? undefined;
  }

  /** @internal — used by rendering pipeline only; not for cross-plugin access */
  getViewContext(viewId: string): Record<string, unknown> | undefined {
    return this.viewContexts.get(viewId);
  }

  /** Get visible views for a container, evaluating when clauses */
  getVisibleViews(containerId: string): RegisteredView[] {
    return this.views.filter(
      v => v.containerId === containerId && contextKeys.evaluate(v.when)
    );
  }

  /** Get all registered views for a container (with when-clause filtering) */
  getViews(containerId: string): RegisteredView[] {
    return this.views.filter(
      v => v.containerId === containerId && contextKeys.evaluate(v.when)
    );
  }

  /** Get all registered containers, optionally filtered by location */
  getContainers(location?: "sidebar" | "panel"): RegisteredViewContainer[] {
    if (!location) return this.containers;
    return this.containers.filter(c => c.location === location);
  }

  /** Dispose all views and containers for a plugin */
  disposePlugin(pluginId: string): void {
    // Clean up contexts for views belonging to this plugin
    for (const view of this.views.filter(v => v.pluginId === pluginId)) {
      this.viewContexts.delete(view.id);
    }
    this.views = this.views.filter(v => v.pluginId !== pluginId);
    this.containers = this.containers.filter(c => c.pluginId !== pluginId);
  }
}

export { type RegisteredView, type RegisteredViewContainer };
export const viewRegistry = new ViewRegistry();
