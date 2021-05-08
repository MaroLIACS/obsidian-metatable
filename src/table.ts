import { MetatableSettings } from './settings'

// A map between known keys and their mapping function.
interface Keymap {
  [key: string]: string;
}

interface Mappers {
  [key: string]: (value: string) => HTMLElement;
}

/**
 * A function to map from a frontmatter node into an HTML element.
 */
type Mapper = (value: any, member: Member, settings: Settings) => HTMLElement;

interface Member {
  key: string;
  mapper: Mapper;
  foldable: boolean;
}

interface Settings {
  mode: string; // expansionMode
  nullValue: string;
  depth: number;
  ignoredKeys: string[];
  members: Member[];
}

function toggle(trigger: HTMLElement) {
  const isExpanded = trigger.getAttribute('aria-expanded') == 'true'
  trigger.setAttribute('aria-expanded', String(!isExpanded))
}

function clickHandler(event: Event, searchFn: (query: string) => void) {
  const trigger: HTMLElement = event.target as HTMLElement

  if (trigger?.hasAttribute('aria-expanded')) {
    event.stopPropagation();
    toggle(trigger)
    return;
  }

  if (trigger?.hasAttribute('href')) {
    event.stopPropagation();
    const href = trigger.getAttribute('href')

    if (href.startsWith('#')) {
      searchFn(`tag:${href}`)
    }
  }
}

function keyHandler(event: KeyboardEvent) {
  const trigger: HTMLElement = event.target as HTMLElement

  if ((event.code == 'Space' || event.code == 'Enter') && trigger?.hasAttribute('aria-expanded')) {
    event.stopPropagation();
    event.preventDefault();
    toggle(trigger)
  }
}


function tag(value: string): HTMLElement {
  const a = document.createElement('a')
  a.addClass('tag')
  a.setAttribute('target', '_blank')
  a.setAttribute('rel', 'noopener')
  a.setAttribute('href', `#${value}`)
  a.append(`${value}`)

  return a
}

/**
 * A list of tags.
 */
function taglist(data: string[], member: Member, settings: Settings): HTMLElement {
  const root = document.createElement('ul')
  const { depth } = settings
  const { mapper } = member

  root.addClass('tag-list')

  data.forEach((item: string) => {
    const li = document.createElement('li')
    const value = tag(item)

    li.append(value)
    root.append(li)
  })

  return root
}


function url(value: string): HTMLElement {
  const a = document.createElement('a')
  a.addClass('external-link')
  a.setAttribute('target', '_blank')
  a.setAttribute('rel', 'noopener')
  a.setAttribute('href', value)
  a.append(value)

  return a
}


function isExpanded(value: string): boolean {
  return value == 'expanded'
}

function isOpen(mode: string, depth: number): boolean {
  if (mode == 'expanded') {
    return true
  }

  // Keep the root open when leafs are collapsed
  if (mode == 'leaf-collapsed' && depth == 0) {
    return true
  }

  // all-collapsed
  return false
}

function isUrl(value: string): boolean {
  const allowedProtocols = ['http:', 'https:']

  try {
    const url = new URL(value)

    return allowedProtocols.some(protocol => url.protocol == protocol)
  } catch(_) {
    return false
  }
}

function enrichValue(value: string): string | HTMLElement {
  // Link URLs
  if (isUrl(value)) {
    return url(value)
  }

  return value
}


/**
 * A set member with a scalar value.
 */
function leafMember(label: string, data: string | null, settings: Settings): HTMLElement {
  const { members } = settings
  const root = document.createElement('tr')
  const key = document.createElement('th')
  const value = document.createElement('td')
  const special = members.find(m => m.key == label)
  const datum = special ? special.mapper(data, special, settings) : enrichValue(data)

  key.addClass('key')
  key.append(label)
  value.addClass('value')
  value.append(datum)

  root.addClass('member')
  root.append(key)
  root.append(value)

  return root
}

/**
 * A set member with a complex value.
 */
function nodeMember(label: string, value: any, settings: Settings): HTMLElement {
  const root = details(label, value, { ...settings, depth: settings.depth + 1 })
  root.addClass('member')

  return root
}

/**
 * A set member.
 */
function member(label: string, value: any, settings: Settings): HTMLElement {
  const patchedValue = value == null ? settings.nullValue : value

  if (typeof patchedValue == 'object') {
    return nodeMember(label, value, settings)
  }

  return leafMember(label, patchedValue, settings)
}

/**
 * A set of members.
 */
function set(data: object, settings: Settings): HTMLElement {
  const root = document.createElement('table')
  const { depth, ignoredKeys } = settings
  const valueSettings = { ...settings, depth: depth + 1 }

  root.addClass('set')
  Object.entries(data).forEach(([label, value]: [string, unknown]) => {
    if (ignoredKeys.some(key => key == label)) {
      return;
    }
    root.append(member(label, value, valueSettings))
  })

  return root
}


/**
 * A list of members.
 */
function list(data: any[], settings: Settings): HTMLElement {
  const root = document.createElement('ul')
  const { depth } = settings
  const valueSettings = { ...settings, depth: depth + 1 }

  data.forEach((item: any) => {
    let value
    const li = document.createElement('li')

    if (Array.isArray(item)) {
      value = list(item, valueSettings)
    } else if (typeof item == 'object') {
      value = set(item , valueSettings)
    } else {
      value = item
    }

    li.append(value)

    root.append(li)
  })

  return root
}


function ordinaryValue(data: any, settings: Settings): HTMLElement {
  return Array.isArray(data)
    ? list(data, settings)
    : set(data, settings)
}

/**
 * A collapsible group.
 */
function details(label: string, data: any, settings: Settings): HTMLElement {
  const root = document.createElement('tr')
  const key = document.createElement('th')
  const value = document.createElement('td')

  const { depth, mode, members } = settings
  const special = members.find(m => m.key == label)
  const valueSettings = { ...settings, depth: depth + 1 }
  const valueId = `${label}-${depth}`
  const datum = special
    ? special.mapper(data, special, settings)
    : ordinaryValue(data, valueSettings)

  key.addClass('key')
  key.append(label)
  root.append(key)

  value.addClass('value')
  value.setAttribute('id', valueId)
  value.append(datum)
  root.append(value)

  if (special == undefined || special.foldable) {
    console.log(special)
    console.log(members)
    const marker = document.createElement('div')

    key.addClass('toggle')
    key.setAttribute('role', 'button')
    key.setAttribute('aria-expanded', String(isOpen(mode, depth)))
    key.setAttribute('aria-controls', valueId)
    key.setAttribute('tabindex', '0')

    marker.addClass('marker')
    value.append(marker)
  }

  return root
}

/**
 * Normalises a list of tags as an array of strings.
 */
function normaliseTags(data: null | string | string[]): string[] {
  if (typeof data == 'string') {
    return data.split(',').map(x => x.trim())
  }

  return data
}

function sheath(data: object, settings: Settings): HTMLElement {
  const root = document.createElement('details')
  const summary = document.createElement('summary')
  // @ts-ignore
  const { tags } = data
  const ndata = tags ? { ...data, tags: normaliseTags(tags) } : data
  const value = set(ndata, settings)

  if (isOpen(settings.mode, 0)) {
    root.setAttribute('open', '')
  }

  summary.append('Metadata')
  root.addClass('metatable')
  root.append(summary)
  root.append(value)

  return root
}

export default function metatable(data: object, pluginSettings: MetatableSettings): DocumentFragment {
  const fragment = new DocumentFragment()
  const { expansionMode: mode, searchFn, nullValue, skipKey, ignoredKeys } = pluginSettings
  const settings = {
    mode,
    nullValue,
    ignoredKeys,
    depth: 0,
    members: [{
      key: 'tags',
      mapper: taglist,
      foldable: false,
    }],
  }

  // @ts-ignore
  const skip = data[skipKey]

  if (skip) {
    return fragment
  }

  const root = sheath(data, settings)
  root.addEventListener('click', (e) => clickHandler(e, searchFn))
  root.addEventListener('keydown', keyHandler)
  fragment.append(root)

  return fragment
}
